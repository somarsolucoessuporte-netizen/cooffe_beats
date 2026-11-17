import { MercadoPagoConfig, Payment, Point } from "mercadopago";
import { criarPagamentoPoint, criarPixQRCode, cancelarOrderMp, cancelarPaymentIntentPoint } from "../mercadopago";
import { ehPixQr } from "./domain";
import type { Provedor, Resultado } from "./domain";

function config() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Mercado Pago indisponível");
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10000, maxRetries: 0 } });
}

export async function resultadoPayment(paymentId: string): Promise<Resultado> {
  const p = await new Payment(config()).get({ id: paymentId });
  return {
    referencia: p.external_reference ?? "",
    paymentId: String(p.id),
    valorCentavos: Math.round(Number(p.transaction_amount) * 100),
    moeda: p.currency_id,
    metodo: p.payment_type_id === "bank_transfer" ? "PIX" : p.payment_type_id === "debit_card" ? "CARTAO_DEBITO" : p.payment_type_id === "credit_card" ? "CARTAO_CREDITO" : "OUTRO",
    status: p.status === "refunded" || p.status === "charged_back" || Number(p.transaction_amount_refunded) > 0 ? "REVIEW" : p.status === "approved" ? "PAID" : p.status === "rejected" || p.status === "cancelled" ? "FAILED" : "PENDING",
  };
}

export async function resultadoIntent(intentId: string): Promise<Resultado> {
  const intent = await new Point(config()).searchPaymentIntent({ payment_intent_id: intentId });
  const referencia = intent.additional_info?.external_reference ?? "";
  const paymentId = (intent.payment as { id?: string | number } | undefined)?.id;
  if (paymentId) return { ...await resultadoPayment(String(paymentId)), intentId };
  // Absence of a payment in the intent is not enough to conclude failure.
  const encontrado = await procurar(referencia);
  if (encontrado) return { ...encontrado, intentId };
  return { referencia, intentId, status: ["CANCELED", "ABANDONED", "ERROR"].includes(intent.state?.toUpperCase() ?? "") ? "FAILED" : "PENDING" };
}

/** Resultado de uma order de Pix QR (Orders API). Cancelada/expirada = FAILED; processed = PAID. */
export async function resultadoOrder(orderId: string): Promise<Resultado> {
  const res = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN ?? ""}` },
    signal: AbortSignal.timeout(10000),
  });
  const o = await res.json().catch(() => null) as {
    id?: string; status?: string; external_reference?: string; total_amount?: string; currency?: string;
    transactions?: { payments?: { id?: string; status?: string; status_detail?: string }[]; refunds?: unknown[] };
  } | null;
  if (!res.ok || !o?.id) throw new Error(`Order ${orderId} indisponível (HTTP ${res.status})`);
  const pagamento = o.transactions?.payments?.[0];
  const reembolsada = (o.transactions?.refunds?.length ?? 0) > 0 || o.status === "refunded" || pagamento?.status === "refunded";
  return {
    referencia: o.external_reference ?? "",
    intentId: o.id,
    paymentId: pagamento?.id ?? o.id,
    valorCentavos: Math.round(Number(o.total_amount) * 100),
    moeda: o.currency ?? "BRL",
    metodo: "PIX",
    status: reembolsada ? "REVIEW" : o.status === "processed" || o.status === "paid" ? "PAID" : ["canceled", "cancelled", "expired", "failed"].includes(o.status ?? "") ? "FAILED" : "PENDING",
  };
}

async function procurar(referencia: string): Promise<Resultado | null> {
  const r = await new Payment(config()).search({ options: { external_reference: referencia, sort: "date_created", criteria: "desc", limit: 100 } });
  const resultados = (r.results ?? []).filter(p => p.external_reference === referencia);
  const aprovados = resultados.filter(p => p.status === "approved");
  if (aprovados.length > 1) return { referencia, status: "REVIEW" };
  const escolhido = aprovados[0] ?? resultados[0];
  // Search without an intent can locate money, but cannot prove a lost creation never happened.
  return escolhido?.id ? resultadoPayment(String(escolhido.id)) : null;
}

export const mercadoPagoDivisao: Provedor = {
  async criar(input) {
    const intent = await criarPagamentoPoint({ valor: input.valorCentavos / 100, referencia: input.referencia, descricao: "Coffee Beats - parcela da conta", deviceId: input.deviceId, semRetentativa: true });
    return { intentId: intent.id };
  },
  async criarPix(input) {
    return criarPixQRCode({ valor: input.valorCentavos / 100, referencia: input.referencia, descricao: "Coffee Beats - parcela da conta" });
  },
  async cancelar(input) {
    if (!input.intentId) return false;
    return ehPixQr(input.deviceId) ? cancelarOrderMp(input.intentId) : cancelarPaymentIntentPoint(input.deviceId, input.intentId);
  },
  async consultar(input) {
    if (input.intentId && ehPixQr(input.deviceId)) return resultadoOrder(input.intentId);
    if (ehPixQr(input.deviceId)) return null;
    if (input.intentId) return resultadoIntent(input.intentId);
    const resultado = await procurar(input.referencia);
    return resultado?.status === "FAILED" ? { ...resultado, status: "PENDING" } : resultado;
  },
};
