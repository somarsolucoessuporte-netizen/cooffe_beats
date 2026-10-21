import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reconciliarPagamentoMp } from "@/lib/mp-pagamento";

// Reconsulta na API do Mercado Pago no máximo a cada 6s por pedido (o polling roda a cada 2s)
const INTERVALO_RECONCILIAR_MS = 6000;
const ultimaReconciliacao = new Map<string, number>();

// Lê o status já gravado no banco (fonte de verdade: webhook).
// Cobrança na Point do Mercado Pago ainda pendente: reconsulta a intenção na API,
// para o totem não ficar preso quando o webhook não chega.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> },
) {
  const { pedidoId } = await params;

  let pagamento = await prisma.pagamento.findUnique({
    where:  { pedidoId },
    select: { status: true, referencia: true, payload: true },
  });

  if (!pagamento) {
    return NextResponse.json({ ok: false, error: "Pagamento não encontrado" }, { status: 404 });
  }

  const agora = Date.now();
  if (pagamento.status === "PENDENTE" && agora - (ultimaReconciliacao.get(pedidoId) ?? 0) >= INTERVALO_RECONCILIAR_MS) {
    ultimaReconciliacao.set(pedidoId, agora);
    try {
      await reconciliarPagamentoMp(pagamento);
      pagamento = await prisma.pagamento.findUnique({
        where:  { pedidoId },
        select: { status: true, referencia: true, payload: true },
      }) ?? pagamento;
    } catch (e) {
      console.warn("[Status] reconciliação MP falhou:", e instanceof Error ? e.message : e);
    }
  }
  if (pagamento.status !== "PENDENTE") ultimaReconciliacao.delete(pedidoId);

  return NextResponse.json({ ok: true, status: pagamento.status });
}
