import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { cancelarPedidosSemPagamento, liberarExpiradas, listarPendencias, resolverPendencias, resumoCaixa } from "@/lib/caixa-fechamento";
import type { Caixa } from "@prisma/client";

export const maxDuration = 30;

function falha(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

async function empresaDaSessao() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { erro: falha("Não autenticado", 401) };
  const empresaId = (session.user as { empresaId?: string }).empresaId;
  if (!empresaId) return { erro: falha("Sessão inválida", 401) };
  return { empresaId };
}

const caixaAberto = (empresaId: string) =>
  prisma.caixa.findFirst({ where: { empresaId, status: "ABERTO" }, orderBy: { abridoEm: "desc" } });

/** Resposta de sucesso: a mesma para o fechamento recém-feito e para um caixa que já estava fechado. */
async function sucesso(empresaId: string, caixa: Caixa, jaFechado: boolean, pendenciasRegistradas = 0) {
  const { divisao: _divisao, ...totais } = await resumoCaixa(empresaId, caixa.id);
  void _divisao;
  return NextResponse.json({
    ok: true,
    data: {
      caixaId: caixa.id,
      ...totais,
      abertoEm: caixa.abridoEm,
      fechadoEm: caixa.fechadoEm,
      valorAbertura: Number(caixa.valorAbertura),
      jaFechado,
      pendenciasRegistradas,
    },
  });
}

/** Prévia do fechamento: libera divisões abandonadas e devolve totais e pendências ativas. */
export async function GET() {
  try {
    const ctx = await empresaDaSessao();
    if (ctx.erro) return ctx.erro;
    const { empresaId } = ctx;
    const caixa = await caixaAberto(empresaId);
    if (!caixa) return falha("Nenhum caixa aberto encontrado", 404);
    const liberadas = await liberarExpiradas(caixa.id);
    const [resumo, pendencias] = await Promise.all([resumoCaixa(empresaId, caixa.id), listarPendencias(caixa.id)]);
    return NextResponse.json({ ok: true, data: { resumo, pendencias, liberadas } });
  } catch (e) {
    console.error("[Caixa/fechar GET]", e);
    return falha("Não foi possível conferir o caixa: " + (e instanceof Error ? e.message : "erro desconhecido"), 500);
  }
}

/**
 * Body: { caixaId?, observacao?, valorFechamento?, resolver?: boolean, forcar?: boolean }
 * - caixaId: o caixa que a tela está fechando. Evita que uma aba antiga feche um caixa aberto depois.
 * - resolver: cancela as pendências ativas (no Mercado Pago em segundo plano) antes de fechar.
 * - forcar: cancela antes o que não recebeu nenhum valor; o que restar é registrado na observação.
 * Idempotente: se o caixa já estiver fechado, responde sucesso com o resumo existente.
 */
export async function POST(req: Request) {
  try {
    const ctx = await empresaDaSessao();
    if (ctx.erro) return ctx.erro;
    const { empresaId } = ctx;
    const body = await req.json().catch(() => ({})) as { caixaId?: string; observacao?: string; valorFechamento?: number; resolver?: boolean; forcar?: boolean };

    const caixa = typeof body.caixaId === "string" && body.caixaId
      ? await prisma.caixa.findFirst({ where: { id: body.caixaId, empresaId } })
      : await caixaAberto(empresaId) ??
        await prisma.caixa.findFirst({ where: { empresaId, status: "FECHADO" }, orderBy: { fechadoEm: "desc" } });
    if (!caixa) return falha("Caixa não encontrado", 404);
    if (caixa.status !== "ABERTO") return await sucesso(empresaId, caixa, true);

    await liberarExpiradas(caixa.id);
    if (body.resolver || body.forcar) await resolverPendencias(empresaId, caixa.id);
    if (body.forcar) await cancelarPedidosSemPagamento(empresaId, caixa.id);
    const pendencias = await listarPendencias(caixa.id);

    if (pendencias.length && !body.forcar) {
      return falha(
        `Há ${pendencias.length} pendência(s) neste caixa. Resolva-as ou feche mesmo assim.`,
        409,
        { pendencias },
      );
    }

    // O banco impede fechar com divisão em aberto: sobra apenas a que tem valor recebido ou está em revisão.
    const divisoes = pendencias.filter(p => p.tipo === "DIVISAO");
    if (divisoes.length) {
      return falha(
        `O caixa continua aberto: há divisão de conta com valor recebido ou em revisão (${divisoes.map(p => `total R$ ${p.valor.toFixed(2)}, recebido R$ ${p.pago.toFixed(2)}`).join("; ")}). Conclua em Contas divididas.`,
        409,
        { pendencias },
      );
    }

    const { totalVendas } = await resumoCaixa(empresaId, caixa.id);

    const notaPendencias = pendencias.length
      ? `Fechado com pendências: ${pendencias.map(p => `${p.descricao} R$ ${p.valor.toFixed(2)} (pedido ${p.pedidoId})`).join("; ")}`
      : null;
    const observacao = [body.observacao, notaPendencias].filter(Boolean).join(" | ") || null;

    const fechado = await prisma.caixa.updateMany({
      where: { id: caixa.id, status: "ABERTO" },
      data: {
        status: "FECHADO",
        valorFechamento: body.valorFechamento != null ? Number(body.valorFechamento) : totalVendas,
        observacao,
        fechadoEm: new Date(),
      },
    });
    const atual = await prisma.caixa.findUniqueOrThrow({ where: { id: caixa.id } });
    // count 0 = outra requisição fechou primeiro: mesmo resultado para quem clicou
    return await sucesso(empresaId, atual, fechado.count === 0, fechado.count === 0 ? 0 : pendencias.length);
  } catch (e) {
    console.error("[Caixa/fechar POST]", e);
    return falha("Erro ao fechar o caixa: " + (e instanceof Error ? e.message : "erro desconhecido"), 500);
  }
}
