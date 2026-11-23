import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { liberarExpiradas, listarPendencias, resolverPendencias, resumoCaixa } from "@/lib/caixa-fechamento";

export const maxDuration = 30;

function falha(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

async function contexto() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { erro: falha("Não autenticado", 401) };
  const empresaId = (session.user as { empresaId?: string }).empresaId;
  if (!empresaId) return { erro: falha("Sessão inválida", 401) };
  const caixa = await prisma.caixa.findFirst({ where: { empresaId, status: "ABERTO" }, orderBy: { abridoEm: "desc" } });
  if (!caixa) return { erro: falha("Nenhum caixa aberto encontrado", 404) };
  return { empresaId, caixa };
}

/** Prévia do fechamento: libera divisões abandonadas e devolve totais e pendências ativas. */
export async function GET() {
  try {
    const ctx = await contexto();
    if (ctx.erro) return ctx.erro;
    const { empresaId, caixa } = ctx;
    const liberadas = await liberarExpiradas(caixa.id);
    const [resumo, pendencias] = await Promise.all([resumoCaixa(empresaId, caixa.id), listarPendencias(caixa.id)]);
    return NextResponse.json({ ok: true, data: { resumo, pendencias, liberadas } });
  } catch (e) {
    console.error("[Caixa/fechar GET]", e);
    return falha("Não foi possível conferir o caixa: " + (e instanceof Error ? e.message : "erro desconhecido"), 500);
  }
}

/**
 * Body: { observacao?, valorFechamento?, resolver?: boolean, forcar?: boolean }
 * - resolver: cancela as pendências ativas (no Mercado Pago em segundo plano) antes de fechar.
 * - forcar: fecha mesmo com pendências, registrando-as na observação do caixa.
 */
export async function POST(req: Request) {
  try {
    const ctx = await contexto();
    if (ctx.erro) return ctx.erro;
    const { empresaId, caixa } = ctx;
    const body = await req.json().catch(() => ({})) as { observacao?: string; valorFechamento?: number; resolver?: boolean; forcar?: boolean };

    await liberarExpiradas(caixa.id);
    if (body.resolver) await resolverPendencias(empresaId, caixa.id);
    const pendencias = await listarPendencias(caixa.id);

    if (pendencias.length && !body.forcar) {
      return falha(
        `Há ${pendencias.length} pendência(s) neste caixa. Resolva-as ou feche mesmo assim.`,
        409,
        { pendencias },
      );
    }

    const resumo = await resumoCaixa(empresaId, caixa.id);
    const { divisao: _divisao, ...totais } = resumo;
    void _divisao;

    const notaPendencias = pendencias.length
      ? `Fechado com pendências: ${pendencias.map(p => `${p.descricao} R$ ${p.valor.toFixed(2)} (pedido ${p.pedidoId})`).join("; ")}`
      : null;
    const observacao = [body.observacao, notaPendencias].filter(Boolean).join(" | ") || null;

    const fechado = await prisma.caixa.updateMany({
      where: { id: caixa.id, status: "ABERTO" },
      data: {
        status: "FECHADO",
        valorFechamento: body.valorFechamento != null ? Number(body.valorFechamento) : resumo.totalVendas,
        observacao,
        fechadoEm: new Date(),
      },
    });
    if (fechado.count === 0) return falha("Este caixa já foi fechado", 409);

    return NextResponse.json({
      ok: true,
      data: { caixaId: caixa.id, ...totais, pendenciasRegistradas: pendencias.length },
    });
  } catch (e) {
    console.error("[Caixa/fechar POST]", e);
    return falha("Erro ao fechar o caixa: " + (e instanceof Error ? e.message : "erro desconhecido"), 500);
  }
}
