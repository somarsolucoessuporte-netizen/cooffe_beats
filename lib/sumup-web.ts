import "server-only";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

const SUMUP_API  = "https://api.sumup.com";
const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

export interface SumupConfigDb {
  clientId:     string;
  clientSecret: string;
  merchantCode: string;
  affiliateKey: string | null;
}

// Busca e valida credenciais do banco — nunca expõe ao cliente
export async function getSumupConfigDb(): Promise<SumupConfigDb> {
  const config = await prisma.configuracao.findUnique({ where: { empresaId: EMPRESA_ID } });
  if (!config?.sumupClientId || !config?.sumupClientSecret || !config?.sumupMerchantCode) {
    throw new Error("SumUp não configurado. Configure em Admin → Pagamentos.");
  }
  if (!config.sumupOnlineAtivo) {
    throw new Error("Pagamento online SumUp não está ativo.");
  }
  return {
    clientId:     config.sumupClientId,
    clientSecret: config.sumupClientSecret,
    merchantCode: config.sumupMerchantCode,
    affiliateKey: config.sumupAffiliateKey,
  };
}

// Obtém token OAuth2 client_credentials
export async function getSumupToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${SUMUP_API}/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    cache:   "no-store",
  });
  const data = await res.json() as { access_token?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error("SumUp token falhou: " + (data.error_description ?? JSON.stringify(data)));
  }
  return data.access_token;
}

export async function criarSumupCheckout(params: {
  token:        string;
  merchantCode: string;
  sessaoId:     string;
  total:        number;
  returnUrl:    string;
}): Promise<{ id: string; checkout_url?: string; status: string }> {
  const res = await fetch(`${SUMUP_API}/v0.1/checkouts`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${params.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      checkout_reference: params.sessaoId,
      amount:             params.total,
      currency:           "BRL",
      merchant_code:      params.merchantCode,
      description:        "Coffee & Beats – Pedido Online",
      return_url:         params.returnUrl,
    }),
    cache: "no-store",
  });
  const data = await res.json() as { id?: string; status?: string; checkout_url?: string };
  if (!data.id) throw new Error("SumUp checkout falhou: " + JSON.stringify(data));
  return { id: data.id, checkout_url: data.checkout_url, status: data.status ?? "PENDING" };
}

// Valida assinatura HMAC-SHA256 do webhook SumUp
export function validarAssinaturaWebhook(rawBody: string, signature: string, affiliateKey: string): boolean {
  const expected = createHmac("sha256", affiliateKey).update(rawBody).digest("hex");
  return expected === signature;
}
