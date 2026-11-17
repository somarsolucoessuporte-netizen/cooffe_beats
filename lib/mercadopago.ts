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
  tipo?:      "credit_card" | "debit_card" | "qr";
  semRetentativa?: boolean;
}): Promise<{ id: string; state: string }> {
  const res = await new Point(config()).createPaymentIntent({
    device_id: params.deviceId,
    request: {
      // Point Integration API trabalha em centavos
      amount:      Math.round(params.valor * 100),
      description: params.descricao.slice(0, 64),
      payment: params.tipo
        ? params.tipo === "qr"
          ? { type: "qr" }
          : { installments: 1, type: params.tipo, installments_cost: "seller" }
        : undefined,
      additional_info: {
        external_reference: params.referencia, // correlaciona com o Pagamento no webhook
        print_on_terminal:  true,
      },
    },
    requestOptions: { idempotencyKey: params.referencia, ...(params.semRetentativa ? { maxRetries: 0 } : {}) },
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

// ─── PIX QR DINÂMICO (Orders API) ────────────────────────────────────────────

/**
 * Gera um QR Pix dinâmico (Orders API) para exibir na tela do totem, em paralelo
 * à cobrança da Point. A order expira sozinha no Mercado Pago.
 * Sem external_pos_id: a API aceita sem ele e não há env configurada para isso.
 */
export async function criarPixQRCode(params: {
  valor:      number;
  referencia: string;
  descricao:  string;
}): Promise<{ orderId: string; qrData: string }> {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Mercado Pago: configure MP_ACCESS_TOKEN no .env");

  const total = params.valor.toFixed(2);
  const res = await fetch("https://api.mercadopago.com/v1/orders", {
    method:  "POST",
    headers: {
      Authorization:       `Bearer ${accessToken}`,
      "X-Idempotency-Key": crypto.randomUUID(),
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      type:               "qr",
      total_amount:       total,
      external_reference: params.referencia,
      description:        params.descricao.slice(0, 150),
      config:             { qr: { mode: "dynamic" } },
      transactions:       { payments: [{ amount: total }] },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const json = await res.json().catch(() => null) as
    { id?: string; type_response?: { qr_data?: string }; message?: string; errors?: unknown } | null;

  if (!res.ok || !json?.id || !json.type_response?.qr_data) {
    console.error("[MP Pix QR] falha ao criar order:", res.status, JSON.stringify(json));
    throw new Error(json?.message ?? `Mercado Pago: order Pix não criada (HTTP ${res.status})`);
  }
  return { orderId: json.id, qrData: json.type_response.qr_data };
}

/** Consulta uma order (tópico "order" do webhook). Só "processed" conta como pago. */
export async function consultarOrderMp(orderId: string): Promise<ResultadoPagamentoMp> {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Mercado Pago: configure MP_ACCESS_TOKEN no .env");

  const res = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal:  AbortSignal.timeout(10_000),
  });
  const json = await res.json().catch(() => null) as
    { id?: string; status?: string; external_reference?: string } | null;
  if (!res.ok || !json?.id) throw new Error(`Mercado Pago: order ${orderId} não consultada (HTTP ${res.status})`);

  const pago = json.status === "processed" || json.status === "paid";
  return {
    // Order não paga (created/expired/canceled) fica PENDING: não pode recusar o Pagamento,
    // porque a Point ainda pode estar cobrando em paralelo.
    status:     pago ? "PAID" : "PENDING",
    referencia: json.external_reference ?? undefined,
    paymentId:  json.id,
    tipo:       "bank_transfer",
  };
}

/** Erros de "já cancelada / expirada / finalizada" contam como sucesso no cancelamento. */
const JA_ENCERRADO = /cancel|expir|final|processed|paid|refund|already|not[_ ]found|closed|conclu|conflict/i;

/**
 * Cancela a order do Pix QR. Nunca lança: o cancelamento não pode impedir a baixa do pedido.
 * Retorna true quando a order está (ou já estava) encerrada.
 */
export async function cancelarOrderMp(orderId: string): Promise<boolean> {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) throw new Error("MP_ACCESS_TOKEN ausente");
    const res = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "X-Idempotency-Key": crypto.randomUUID() },
      signal:  AbortSignal.timeout(8_000),
    });
    if (res.ok) return true;
    const corpo = await res.text().catch(() => "");
    if (res.status === 404 || res.status === 409 || JA_ENCERRADO.test(corpo)) return true;
    console.warn("[MP cancelar order]", orderId, res.status, corpo.slice(0, 300));
    return false;
  } catch (e) {
    console.warn("[MP cancelar order]", orderId, e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Libera a maquininha cancelando a intenção de pagamento (reutiliza cancelarPagamentoPoint).
 * Nunca lança; "já cancelada/finalizada" conta como sucesso.
 */
export async function cancelarPaymentIntentPoint(deviceId: string, paymentIntentId: string): Promise<boolean> {
  try {
    await cancelarPagamentoPoint(deviceId, paymentIntentId);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const detalhe = typeof e === "object" && e ? JSON.stringify(e) : msg;
    if (JA_ENCERRADO.test(msg) || JA_ENCERRADO.test(detalhe)) return true;
    console.warn("[MP cancelar intenção Point]", paymentIntentId, (msg || detalhe).slice(0, 300));
    return false;
  }
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
