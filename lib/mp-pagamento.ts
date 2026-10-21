import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarPagamentoPoint } from "@/lib/mercadopago";
import { liberarPedidoPago } from "@/lib/liberar-pedido";

/** Dados do Mercado Pago gravados em Pagamento.payload na criação da cobrança. */
export interface PayloadMp {
  provider?:        string;
  paymentIntentId?: string;
  deviceId?:        string;
}

/**
 * Grava no Pagamento (por referência) o resultado consultado na API do Mercado Pago.
 * PAID → APROVADO e libera o pedido; FAILED → RECUSADO (só se ainda PENDENTE).
 * Usado pelo webhook e pela reconciliação do polling — idempotente.
 */
export async function aplicarResultadoMp(
  referencia: string,
  resultado:  { status: "PENDING" | "PAID" | "FAILED" },
  payload:    Prisma.InputJsonObject,
) {
  if (resultado.status === "PAID") {
    const result = await prisma.pagamento.updateMany({
      where: { referencia, status: { not: "APROVADO" } },
      data:  { status: "APROVADO", paidAt: new Date(), payload },
    });

    if (result.count > 0) {
      // Pedido do totem nasce AGUARDANDO_PAGAMENTO; aprovado, vai para RECEBIDO e entra no KDS.
      const pagamento = await prisma.pagamento.findFirst({
        where:  { referencia },
        select: { pedidoId: true },
      });
      if (pagamento?.pedidoId) await liberarPedidoPago(pagamento.pedidoId);
    }
  } else if (resultado.status === "FAILED") {
    // Recusado/cancelado/erro na Point: o polling do totem vê RECUSADO e volta à escolha.
    // Só mexe em pendentes — cancelamento feito pelo totem já gravou CANCELADO.
    await prisma.pagamento.updateMany({
      where: { referencia, status: "PENDENTE" },
      data:  { status: "RECUSADO", payload },
    });
  }
}

/** Reconsulta na API a intenção Point de um Pagamento pendente e grava o resultado. */
export async function reconciliarPagamentoMp(pagamento: { referencia: string | null; payload: unknown }) {
  const mp = pagamento.payload as PayloadMp | null;
  if (!pagamento.referencia || mp?.provider !== "mercadopago" || !mp.paymentIntentId) return;

  const resultado = await verificarPagamentoPoint(mp.paymentIntentId);
  await aplicarResultadoMp(pagamento.referencia, resultado, {
    provider: "mercadopago", deviceId: mp.deviceId, ...resultado, paymentIntentId: mp.paymentIntentId,
  });
}
