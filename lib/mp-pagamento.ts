import type { MetodoPagamento, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarPagamentoPoint, consultarOrderMp, cancelarOrderMp, cancelarPaymentIntentPoint, type ResultadoPagamentoMp } from "@/lib/mercadopago";
import { liberarPedidoPago } from "@/lib/liberar-pedido";
import { criarPedidoDaSessao } from "@/lib/checkout-sessao";

/** Dados do Mercado Pago gravados em Pagamento.payload na criação da cobrança. */
export interface PayloadMp {
  provider?:        string;
  paymentIntentId?: string;
  deviceId?:        string;
}

export type OrigemMp = "point" | "qr";

export interface ResultadoBaixaMp {
  /** A baixa realmente mudou o status para APROVADO (primeira aprovação). */
  primeiraBaixa: boolean;
  /** Segunda aprovação, por outro meio, de pedido já pago (cobrança duplicada). */
  duplicado:     boolean;
}

/**
 * Grava no Pagamento (por referência) o resultado consultado na API do Mercado Pago.
 * PAID → APROVADO e libera o pedido; FAILED → RECUSADO (só se ainda PENDENTE).
 * Usado pelo webhook e pela reconciliação do polling — idempotente.
 *
 * `origem` diz por qual meio veio a aprovação (Point ou Pix QR da tela). Na primeira
 * baixa, cancela o outro meio para evitar cobrança dupla; se chegar aprovação de outro
 * meio para pedido já pago, não fecha de novo e registra para estorno manual.
 */
export async function aplicarResultadoMp(
  referencia: string,
  resultado:  { status: "PENDING" | "PAID" | "FAILED"; tipo?: string; paymentId?: string },
  payload:    Prisma.InputJsonObject,
  origem?:    OrigemMp,
): Promise<ResultadoBaixaMp> {
  let primeiraBaixa = false;
  let duplicado     = false;

  if (resultado.status === "PAID") {
    // Estado anterior: Point guarda paymentIntentId/deviceId no payload (sobrescrito pela baixa)
    const antes = await prisma.pagamento.findFirst({
      where:  { referencia },
      select: { pedidoId: true, status: true, payload: true, pixOrderId: true },
    });
    const mpAntes = (antes?.payload ?? null) as (PayloadMp & { aprovadoPor?: string }) | null;

    // Na Point o cliente escolhe a forma na maquininha: grava o tipo real quando o MP informa
    const metodo: MetodoPagamento | undefined =
      resultado.tipo === "bank_transfer" ? "PIX" :
      resultado.tipo === "debit_card"    ? "CARTAO_DEBITO" :
      resultado.tipo === "credit_card"   ? "CARTAO_CREDITO" : undefined;
    const dadosPayload: Prisma.InputJsonObject = {
      ...payload,
      ...(origem ? { aprovadoPor: origem } : {}),
      // Aprovado pelo QR: preserva a intenção da Point para poder cancelá-la
      ...(origem === "qr" && mpAntes?.paymentIntentId ? { paymentIntentId: mpAntes.paymentIntentId } : {}),
      ...(origem === "qr" && mpAntes?.deviceId        ? { deviceId:        mpAntes.deviceId }        : {}),
    };
    const result = await prisma.pagamento.updateMany({
      where: { referencia, status: { not: "APROVADO" } },
      data:  { status: "APROVADO", paidAt: new Date(), payload: dadosPayload, ...(metodo ? { metodo } : {}) },
    });

    if (result.count > 0) {
      primeiraBaixa = true;
      // Pedido do totem nasce AGUARDANDO_PAGAMENTO; aprovado, vai para RECEBIDO e entra no KDS.
      try {
        if (antes?.pedidoId) await liberarPedidoPago(antes.pedidoId);
      } finally {
        // Nunca impede a baixa: as funções de cancelamento não lançam
        await cancelarOutroMeio(origem, { pixOrderId: antes?.pixOrderId, mp: mpAntes });
      }
    } else if (origem) {
      // Reconsulta: numa corrida, o estado lido antes pode ser anterior à baixa do outro meio
      const atual   = await prisma.pagamento.findFirst({ where: { referencia }, select: { status: true, payload: true } });
      const mpAtual = (atual?.payload ?? null) as (PayloadMp & { aprovadoPor?: string }) | null;
      if (atual?.status === "APROVADO" && mpAtual?.aprovadoPor && mpAtual.aprovadoPor !== origem) {
      // Outro meio já tinha fechado o pedido e este também foi aprovado: cliente pagou duas vezes
      duplicado = true;
      console.error(
        `PAGAMENTO DUPLICADO - pedido ${antes?.pedidoId ?? "?"} - estornar manualmente` +
        ` | referencia=${referencia} | aprovado primeiro por=${mpAtual.aprovadoPor}` +
        ` | segunda aprovação por=${origem} id MP=${resultado.paymentId ?? "?"}` +
        ` | paymentIntentId=${mpAtual.paymentIntentId ?? "-"} pixOrderId=${antes?.pixOrderId ?? "-"}`,
      );
      }
    }
  } else if (resultado.status === "FAILED") {
    // Recusado/cancelado/erro na Point: o polling do totem vê RECUSADO e volta à escolha.
    // Só mexe em pendentes — cancelamento feito pelo totem já gravou CANCELADO.
    await prisma.pagamento.updateMany({
      where: { referencia, status: "PENDENTE" },
      data:  { status: "RECUSADO", payload },
    });
  }

  return { primeiraBaixa, duplicado };
}

/**
 * Primeira baixa por um meio: cancela o outro (Point ↔ order QR). Origem desconhecida
 * tenta ambos — cancelar o que acabou de ser pago é inofensivo (conta como encerrado).
 */
async function cancelarOutroMeio(
  origem: OrigemMp | undefined,
  dados:  { pixOrderId?: string | null; mp: PayloadMp | null },
) {
  const tarefas: Promise<unknown>[] = [];
  if (origem !== "qr" && dados.pixOrderId) {
    tarefas.push(cancelarOrderMp(dados.pixOrderId));
  }
  if (origem !== "point" && dados.mp?.paymentIntentId && dados.mp.deviceId) {
    tarefas.push(cancelarPaymentIntentPoint(dados.mp.deviceId, dados.mp.paymentIntentId));
  }
  await Promise.allSettled(tarefas);
}

/**
 * Reconsulta na API o Pagamento pendente: a order do Pix QR da tela e/ou a intenção da Point
 * (cada uma pode ser o meio que o cliente usou) e grava o resultado.
 */
export async function reconciliarPagamentoMp(pagamento: { referencia: string | null; payload: unknown; pixOrderId?: string | null }) {
  const mp = pagamento.payload as PayloadMp | null;
  if (!pagamento.referencia || mp?.provider !== "mercadopago") return;

  if (pagamento.pixOrderId) {
    try {
      const order = await consultarOrderMp(pagamento.pixOrderId);
      if (order.status === "PAID") {
        await aplicarResultadoMp(pagamento.referencia, order, { provider: "mercadopago", pixQr: true, ...order }, "qr");
        return;
      }
    } catch (e) {
      console.warn("[MP reconciliar] order QR:", e instanceof Error ? e.message : e);
    }
  }

  if (!mp.paymentIntentId) return;
  const resultado = await verificarPagamentoPoint(mp.paymentIntentId);
  await aplicarResultadoMp(pagamento.referencia, resultado, {
    provider: "mercadopago", deviceId: mp.deviceId, ...resultado, paymentIntentId: mp.paymentIntentId,
  }, "point");
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
