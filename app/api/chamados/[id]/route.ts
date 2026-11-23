import { NextResponse } from "next/server";
import { z } from "zod";
import { anexoValido, avisarChamado, evento, PRIORIDADES, q, sessaoChamados, STATUS } from "@/lib/chamados";
import { buscarChamado, type SessaoChamados } from "@/lib/chamados-acesso";

const falha = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const s = await sessaoChamados();
    if (!s) return falha("Não autenticado", 401);
    const { id } = await ctx.params;
    const c = await buscarChamado(id, s);
    if (!c) return falha("Chamado não encontrado", 404);
    const eventos = await q(`SELECT id,tipo,"autorTipo","autorNome",mensagem,"valorAnterior","valorNovo","anexoNome",("anexoDados" IS NOT NULL) AS "temAnexo","criadoEm"
      FROM "ChamadoEvento" WHERE "chamadoId" = $1 ORDER BY "criadoEm", id`, [id]);
    return NextResponse.json({ ok: true, data: { chamado: c, eventos } });
  } catch (e) {
    console.error("[Chamado GET]", e);
    return falha("Não foi possível carregar o chamado", 500);
  }
}

const Acao = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("responder"), mensagem: z.string().trim().min(1).max(5000), anexoNome: z.string().max(200).optional(), anexo: z.string().optional() }),
  z.object({ acao: z.literal("status"), status: z.enum(STATUS) }),
  z.object({ acao: z.literal("prioridade"), prioridade: z.enum(PRIORIDADES) }),
  z.object({ acao: z.literal("reabrir"), mensagem: z.string().trim().max(5000).optional() }),
]);

/** Nada é apagado: cada resposta, mudança de status/prioridade e reabertura vira um evento com autor e hora. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const s = await sessaoChamados();
    if (!s) return falha("Não autenticado", 401);
    const { id } = await ctx.params;
    const c = await buscarChamado(id, s);
    if (!c) return falha("Chamado não encontrado", 404);
    const v = Acao.safeParse(await req.json().catch(() => null));
    if (!v.success) return falha("Ação inválida", 400);
    const a = v.data;
    const fechado = c.status === "FECHADO";

    if (a.acao === "responder") {
      if (!anexoValido(a.anexo)) return falha("Anexo inválido: envie uma imagem (PNG, JPG, WEBP) de até 2 MB.", 400);
      if (!s.somar && (c.status === "RESOLVIDO" || fechado)) {
        // Cliente respondendo a um chamado encerrado = reabertura (fica no histórico)
        return reabrir(id, c.status, s, c.empresaId, a.mensagem);
      }
      await evento(id, { tipo: "MENSAGEM", sessao: s, mensagem: a.mensagem, anexoNome: a.anexo ? a.anexoNome ?? "anexo" : null, anexoDados: a.anexo ?? null });
      if (s.somar) {
        await q(`UPDATE "Chamado" SET "primeiraRespostaEm" = COALESCE("primeiraRespostaEm", CURRENT_TIMESTAMP), "atualizadoEm" = CURRENT_TIMESTAMP,
          status = CASE WHEN status = 'ABERTO' THEN 'EM_ATENDIMENTO' ELSE status END WHERE id = $1`, [id]);
        if (c.status === "ABERTO") await evento(id, { tipo: "STATUS", sessao: s, de: "ABERTO", para: "EM_ATENDIMENTO" });
      } else {
        // Resposta do cliente a um chamado aguardando ele volta para a fila da Somar
        await q(`UPDATE "Chamado" SET "atualizadoEm" = CURRENT_TIMESTAMP, status = CASE WHEN status = 'AGUARDANDO_CLIENTE' THEN 'EM_ATENDIMENTO' ELSE status END WHERE id = $1`, [id]);
        if (c.status === "AGUARDANDO_CLIENTE") await evento(id, { tipo: "STATUS", sessao: s, de: "AGUARDANDO_CLIENTE", para: "EM_ATENDIMENTO" });
      }
    } else if (a.acao === "status") {
      // Cliente só pode confirmar a solução (fechar) de um chamado resolvido
      if (!s.somar && !(a.status === "FECHADO" && c.status === "RESOLVIDO")) return falha("Sem permissão para esta mudança de status", 403);
      if (a.status === c.status) return NextResponse.json({ ok: true });
      if (fechado) return falha("Chamado fechado: reabra para continuar", 409);
      await q(`UPDATE "Chamado" SET status = $2, "atualizadoEm" = CURRENT_TIMESTAMP,
        "primeiraRespostaEm" = CASE WHEN $3::boolean THEN COALESCE("primeiraRespostaEm", CURRENT_TIMESTAMP) ELSE "primeiraRespostaEm" END,
        "resolvidoEm" = CASE WHEN $2 = 'RESOLVIDO' THEN CURRENT_TIMESTAMP WHEN $2 = 'FECHADO' THEN COALESCE("resolvidoEm", CURRENT_TIMESTAMP) ELSE "resolvidoEm" END,
        "fechadoEm" = CASE WHEN $2 = 'FECHADO' THEN CURRENT_TIMESTAMP ELSE "fechadoEm" END WHERE id = $1`, [id, a.status, s.somar]);
      await evento(id, { tipo: "STATUS", sessao: s, de: c.status, para: a.status });
    } else if (a.acao === "prioridade") {
      if (!s.somar && !(s.gestor || c.usuarioId === s.usuarioId)) return falha("Sem permissão", 403);
      if (a.prioridade !== c.prioridade) {
        await q(`UPDATE "Chamado" SET prioridade = $2, "atualizadoEm" = CURRENT_TIMESTAMP WHERE id = $1`, [id, a.prioridade]);
        await evento(id, { tipo: "PRIORIDADE", sessao: s, de: c.prioridade, para: a.prioridade });
      }
    } else {
      if (c.status !== "RESOLVIDO" && !fechado) return falha("Só é possível reabrir chamados resolvidos ou fechados", 409);
      return reabrir(id, c.status, s, c.empresaId, a.mensagem);
    }
    await avisarChamado(c.empresaId, id, "chamado:atualizado");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Chamado POST]", e);
    return falha("Não foi possível concluir a ação. Tente novamente.", 500);
  }
}

async function reabrir(id: string, statusAnterior: string, s: SessaoChamados, empresaId: string, mensagem?: string) {
  await q(`UPDATE "Chamado" SET status = 'ABERTO', "resolvidoEm" = NULL, "fechadoEm" = NULL, reaberturas = reaberturas + 1, "atualizadoEm" = CURRENT_TIMESTAMP WHERE id = $1 AND status IN ('RESOLVIDO','FECHADO')`, [id]);
  await evento(id, { tipo: "REABERTURA", sessao: s, de: statusAnterior, para: "ABERTO", mensagem: mensagem || null });
  await avisarChamado(empresaId, id, "chamado:atualizado");
  return NextResponse.json({ ok: true });
}
