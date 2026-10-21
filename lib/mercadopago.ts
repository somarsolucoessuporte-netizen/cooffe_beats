import crypto from "node:crypto";
import { MercadoPagoConfig, Payment, Point, Preference } from "mercadopago";

// Cliente criado sob demanda para não quebrar o build quando o token não existe
function config(): MercadoPagoConfig {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Mercado Pago: configure MP_ACCESS_TOKEN no .env");
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
}

// ─── MAQUININHA POINT (Point Integration API) ────────────────────────────────

/** Maquininha Point vinculada à conta (a API real traz mais campos que a tipagem do SDK). */
export interface MpDevice {
  id:              string;
  pos_id?:         number;
  store_id?:       string;
  external_pos_id?: string;
  operating_mode?: string; // "PDV" recebe cobranças da API; "STANDALONE" não
}

/** Lista maquininhas Point vinculadas à conta. */
export async function listarDispositivosPoint(): Promise<MpDevice[]> {
  const res = await new Point(config()).getDevices({ request: {} });
  return (res.devices ?? []) as unknown as MpDevice[];
}

/** Device usado nas cobranças: MP_DEVICE_ID fixo ou a primeira Point em modo PDV. */
export async function obterDevicePoint(): Promise<string> {
  const fixo = process.env.MP_DEVICE_ID;
  if (fixo) return fixo;

  const devices = await listarDispositivosPoint();
  const pdv     = devices.find((d) => d.operating_mode === "PDV");
  if (!pdv) {
    throw new Error(
      devices.length
        ? "Nenhuma Point em modo PDV — ative o modo PDV na maquininha"
        : "Nenhuma maquininha Point vinculada à conta Mercado Pago",
    );
  }
  return pdv.id;
}

/** Cria a intenção de pagamento — a cobrança aparece na tela da Point. */
export async function criarPagamentoPoint(params: {
  valor:      number;
  referencia: string;
  descricao:  string;
  deviceId:   string;
  tipo?:      "credit_card" | "debit_card";
}): Promise<{ id: string; state: string }> {
  const res = await new Point(config()).createPaymentIntent({
    device_id: params.deviceId,
    request: {
      // Point Integration API trabalha em centavos
      amount:      Math.round(params.valor * 100),
      description: params.descricao.slice(0, 64),
      payment: params.tipo
        ? { installments: 1, type: params.tipo, installments_cost: "seller" }
        : undefined,
      additional_info: {
        external_reference: params.referencia, // correlaciona com o Pagamento no webhook
        print_on_terminal:  true,
      },
    },
    requestOptions: { idempotencyKey: params.referencia },
  });

  if (!res.id) throw new Error("Mercado Pago Point: intenção não criada " + JSON.stringify(res));
  return { id: res.id, state: res.state ?? "OPEN" };
}

/**
 * Status consolidado de uma intenção: consulta a intenção e, se finalizada,
 * o pagamento gerado — só "approved" no pagamento conta como pago.
 */
export async function verificarPagamentoPoint(paymentIntentId: string): Promise<{
  status:      "PENDING" | "PAID" | "FAILED";
  referencia?: string;
  paymentId?:  string;
  state?:      string;
}> {
  const intent = await new Point(config()).searchPaymentIntent({ payment_intent_id: paymentIntentId });
  const state      = intent.state?.toUpperCase();
  const referencia = intent.additional_info?.external_reference;
  // A resposta real traz payment.id quando a intenção gera um pagamento
  const paymentId  = (intent.payment as { id?: number | string } | undefined)?.id;

  if (state === "CANCELED" || state === "ABANDONED" || state === "ERROR") {
    return { status: "FAILED", referencia, state };
  }

  if (paymentId) {
    const pagamento = await new Payment(config()).get({ id: paymentId });
    if (pagamento.status === "approved") {
      return { status: "PAID", referencia, paymentId: String(paymentId), state };
    }
    if (pagamento.status === "rejected" || pagamento.status === "cancelled") {
      return { status: "FAILED", referencia, paymentId: String(paymentId), state };
    }
  }

  return { status: "PENDING", referencia, state };
}

export type ResultadoPagamentoMp = {
  status:      "PENDING" | "PAID" | "FAILED";
  referencia?: string;
  paymentId:   string;
  tipo?:       string; // payment_type_id: credit_card | debit_card | bank_transfer (PIX) ...
};

function resultadoPagamento(p: { id?: number | string; status?: string; external_reference?: string; payment_type_id?: string }): ResultadoPagamentoMp {
  const base = { referencia: p.external_reference ?? undefined, paymentId: String(p.id), tipo: p.payment_type_id };
  if (p.status === "approved") return { status: "PAID", ...base };
  if (p.status === "rejected" || p.status === "cancelled") return { status: "FAILED", ...base };
  return { status: "PENDING", ...base };
}

/**
 * Status de um pagamento (tópico "payment" do webhook). Pagamentos da Point e do
 * Checkout Pro carregam o external_reference — é a nossa referência (Pagamento.referencia
 * ou id da CheckoutSessao).
 */
export async function consultarPagamentoMp(paymentId: string): Promise<ResultadoPagamentoMp> {
  return resultadoPagamento(await new Payment(config()).get({ id: paymentId }));
}

/** Pagamento mais relevante de uma referência: aprovado, se houver; senão o mais recente. */
export async function buscarPagamentoPorReferencia(referencia: string): Promise<ResultadoPagamentoMp | null> {
  const res = await new Payment(config()).search({
    options: { external_reference: referencia, sort: "date_created", criteria: "desc" },
  });
  const pagamentos = res.results ?? [];
  const escolhido  = pagamentos.find((p) => p.status === "approved") ?? pagamentos[0];
  return escolhido ? resultadoPagamento(escolhido) : null;
}

// ─── CHECKOUT PRO (pedido online) ────────────────────────────────────────────

/** Cria a preferência do Checkout Pro — o cliente paga na página do Mercado Pago. */
export async function criarPreferenciaCheckoutPro(params: {
  referencia: string;
  itens:      { id: string; titulo: string; quantidade: number; precoUnit: number }[];
  urlRetorno: string;
  urlWebhook: string;
  expiraEm:   Date;
}): Promise<{ id: string; checkoutUrl: string }> {
  const res = await new Preference(config()).create({
    body: {
      items: params.itens.map((i) => ({
        id:          i.id,
        title:       i.titulo.slice(0, 250),
        quantity:    i.quantidade,
        unit_price:  Math.round(i.precoUnit * 100) / 100,
        currency_id: "BRL",
      })),
      external_reference: params.referencia,
      back_urls: { success: params.urlRetorno, pending: params.urlRetorno, failure: params.urlRetorno },
      auto_return:          "approved",
      notification_url:     params.urlWebhook,
      statement_descriptor: "COFFEE BEATS",
      expires:              true,
      expiration_date_to:   params.expiraEm.toISOString(),
    },
    requestOptions: { idempotencyKey: params.referencia },
  });

  if (!res.id || !res.init_point) throw new Error("Mercado Pago: preferência não criada");
  return { id: res.id, checkoutUrl: res.init_point };
}

/** Cancela a cobrança pendente na maquininha (só funciona enquanto a intenção está aberta). */
export async function cancelarPagamentoPoint(deviceId: string, paymentIntentId: string) {
  return new Point(config()).cancelPaymentIntent({ device_id: deviceId, payment_intent_id: paymentIntentId });
}

// ─── WEBHOOK ─────────────────────────────────────────────────────────────────

/**
 * Valida o header x-signature ("ts=...,v1=...") com a assinatura secreta do
 * painel (MP_WEBHOOK_SECRET). Sem secret configurado, não valida — o webhook
 * ainda reconsulta o status na API, então o payload nunca é confiado.
 */
export function validarAssinaturaWebhook(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId:     string | null;
}): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!params.xSignature) return false;

  const partes = Object.fromEntries(
    params.xSignature.split(",").map((p) => p.trim().split("=") as [string, string]),
  );
  if (!partes.ts || !partes.v1) return false;

  let manifest = "";
  if (params.dataId)     manifest += `id:${params.dataId.toLowerCase()};`;
  if (params.xRequestId) manifest += `request-id:${params.xRequestId};`;
  manifest += `ts:${partes.ts};`;

  const esperado = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(esperado);
  const b = Buffer.from(partes.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
