import type { MetodoPagamento, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarPagamentoPoint, type ResultadoPagamentoMp } from "@/lib/mercadopago";
import { liberarPedidoPago } from "@/lib/liberar-pedido";
import { criarPedidoDaSessao } from "@/lib/checkout-sessao";

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
  resultado:  { status: "PENDING" | "PAID" | "FAILED"; tipo?: string },
  payload:    Prisma.InputJsonObject,
) {
  if (resultado.status === "PAID") {
    // Na Point o cliente escolhe a forma na maquininha: grava o tipo real quando o MP informa
    const metodo: MetodoPagamento | undefined =
      resultado.tipo === "bank_transfer" ? "PIX" :
      resultado.tipo === "debit_card"    ? "CARTAO_DEBITO" :
      resultado.tipo === "credit_card"   ? "CARTAO_CREDITO" : undefined;
    const result = await prisma.pagamento.updateMany({
      where: { referencia, status: { not: "APROVADO" } },
      data:  { status: "APROVADO", paidAt: new Date(), payload, ...(metodo ? { metodo } : {}) },
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

/**
 * Checkout Pro: se a referência é uma CheckoutSessao, cria o pedido pago quando
 * aprovado e retorna true. Recusado não encerra a sessão — o cliente pode tentar
 * outro cartão na própria página do Mercado Pago. Retorna false se não é sessão.
 */
export async function aplicarPagamentoCheckoutPro(resultado: ResultadoPagamentoMp, evento?: unknown): Promise<boolean> {
  if (!resultado.referencia) return false;
  const sessao = await prisma.checkoutSessao.findUnique({
    where:  { id: resultado.referencia },
    select: { id: true },
  });
  if (!sessao) return false;

  if (resultado.status === "PAID") {
    const metodo: MetodoPagamento =
      resultado.tipo === "debit_card"  ? "CARTAO_DEBITO"  :
      resultado.tipo === "credit_card" ? "CARTAO_CREDITO" : "PIX";
    await criarPedidoDaSessao(sessao.id, {
      metodo,
      payload: { provider: "mercadopago", checkoutPro: true, ...resultado, evento: (evento ?? null) as Prisma.InputJsonValue },
    });
  }
  return true;
}
