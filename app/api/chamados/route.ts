import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { anexoValido, avisarChamado, COLUNAS_CHAMADO, evento, MOTIVOS, PRIORIDADES, q, sessaoChamados, STATUS, type ChamadoLinha } from "@/lib/chamados";

const falha = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

/** Lista: o cliente vê só os da própria loja (operadores veem só os que abriram); a Somar vê todos, com filtros. */
export async function GET(req: Request) {
  try {
    const s = await sessaoChamados();
    if (!s) return falha("Não autenticado", 401);
    const sp = new URL(req.url).searchParams;
    const cond: string[] = []; const par: unknown[] = [];
    const add = (sql: string, v: unknown) => { par.push(v); cond.push(sql.replace("?", `$${par.length}`)); };
    if (!s.somar) { add(`c."empresaId" = ?`, s.empresaId); if (!s.gestor) add(`c."usuarioId" = ?`, s.usuarioId); }
    const status = sp.get("status"); if (status && (STATUS as readonly string[]).includes(status)) add("c.status = ?", status);
    const motivo = sp.get("motivo"); if (motivo && (MOTIVOS as readonly string[]).includes(motivo)) add("c.motivo = ?", motivo);
    const inicio = sp.get("inicio"); if (inicio && !isNaN(Date.parse(inicio))) add(`c."abertoEm" >= ?::timestamptz`, inicio);
    const fim = sp.get("fim"); if (fim && !isNaN(Date.parse(fim))) add(`c."abertoEm" <= ?::timestamptz`, fim);
    const linhas = await q<ChamadoLinha>(
      `SELECT ${COLUNAS_CHAMADO} FROM "Chamado" c JOIN "Empresa" e ON e.id = c."empresaId"
       ${cond.length ? "WHERE " + cond.join(" AND ") : ""}
       ORDER BY CASE c.status WHEN 'RESOLVIDO' THEN 1 WHEN 'FECHADO' THEN 1 ELSE 0 END,
                CASE c.prioridade WHEN 'URGENTE' THEN 0 WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,
                c."abertoEm" ASC LIMIT 500`, par);
    return NextResponse.json({ ok: true, data: linhas });
  } catch (e) {
    console.error("[Chamados GET]", e);
    return falha("Não foi possível carregar os chamados", 500);
  }
}

const Novo = z.object({
  motivo: z.enum(MOTIVOS), prioridade: z.enum(PRIORIDADES),
  titulo: z.string().trim().min(3).max(150), descricao: z.string().trim().min(5).max(5000),
  anexoNome: z.string().max(200).optional(), anexo: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const s = await sessaoChamados();
    if (!s) return falha("Não autenticado", 401);
    if (s.somar) return falha("Chamados são abertos pelos clientes", 403);
    const v = Novo.safeParse(await req.json().catch(() => null));
    if (!v.success) return falha("Preencha motivo, prioridade, título (mín. 3 letras) e descrição (mín. 5 letras).", 400);
    const d = v.data;
    if (!anexoValido(d.anexo)) return falha("Anexo inválido: envie uma imagem (PNG, JPG, WEBP) de até 2 MB.", 400);
    const id = randomUUID();
    const [c] = await q<{ numero: number }>(
      `INSERT INTO "Chamado" (id,"empresaId","usuarioId","usuarioNome",titulo,descricao,motivo,prioridade) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING numero`,
      [id, s.empresaId, s.usuarioId, s.nome, d.titulo, d.descricao, d.motivo, d.prioridade]);
    await evento(id, { tipo: "ABERTURA", sessao: s, mensagem: d.descricao, anexoNome: d.anexo ? d.anexoNome ?? "anexo" : null, anexoDados: d.anexo ?? null });
    await avisarChamado(s.empresaId, id, "chamado:novo");
    return NextResponse.json({ ok: true, data: { id, numero: c.numero } }, { status: 201 });
  } catch (e) {
    console.error("[Chamados POST]", e);
    return falha("Não foi possível abrir o chamado. Tente novamente.", 500);
  }
}
