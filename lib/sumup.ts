const SUMUP_API = "https://api.sumup.com";

/**
 * Obtém o Bearer token para autenticação na API SumUp.
 *
 * Suporta dois modos:
 * 1. API Key direta (sup_sk_*): formato atual da SumUp — usa como Bearer sem troca OAuth2.
 * 2. OAuth2 client_credentials: modo legado com SUMUP_CLIENT_ID + SUMUP_CLIENT_SECRET.
 */
export async function getSumupToken(): Promise<string> {
  const apiKey = process.env.SUMUP_API_KEY;

  // Modo preferencial: API Key direta (Bearer token sem OAuth2)
  if (apiKey) {
    return apiKey;
  }

  // Fallback: OAuth2 client_credentials (legado)
  const clientId     = process.env.SUMUP_CLIENT_ID;
  const clientSecret = process.env.SUMUP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "SumUp: configure SUMUP_API_KEY (recomendado) ou SUMUP_CLIENT_ID + SUMUP_CLIENT_SECRET no .env"
    );
  }

  const res = await fetch(`${SUMUP_API}/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });

  const data = await res.json() as { access_token?: string };
  if (!data.access_token) {
    throw new Error("SumUp: falha ao obter token OAuth2: " + JSON.stringify(data));
  }
  return data.access_token;
}

export async function criarCheckout(params: {
  valor:      number;
  descricao:  string;
  referencia: string;
}): Promise<{ id: string; checkout_reference: string; checkout_url?: string; status: string }> {
  const token = await getSumupToken();

  const res = await fetch(`${SUMUP_API}/v0.1/checkouts`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      checkout_reference: params.referencia,
      amount:             params.valor,
      currency:           "BRL",
      merchant_code:      process.env.SUMUP_MERCHANT_CODE,
      description:        params.descricao,
      return_url:         `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/pagamentos/sumup/callback`,
    }),
    cache: "no-store",
  });

  const data = await res.json() as { id?: string; checkout_reference?: string; checkout_url?: string; status?: string };
  if (!data.id) {
    throw new Error("SumUp: falha ao criar checkout: " + JSON.stringify(data));
  }
  return {
    id:                 data.id,
    checkout_reference: data.checkout_reference ?? params.referencia,
    checkout_url:       data.checkout_url,
    status:             data.status ?? "PENDING",
  };
}

export async function verificarCheckout(checkoutId: string): Promise<{
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  transaction_code?: string;
}> {
  const token = await getSumupToken();

  const res = await fetch(`${SUMUP_API}/v0.1/checkouts/${checkoutId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache:   "no-store",
  });

  const data = await res.json() as { status?: string; transaction_code?: string };
  return {
    status:           (data.status ?? "PENDING") as "PENDING" | "PAID" | "FAILED" | "EXPIRED",
    transaction_code: data.transaction_code ?? undefined,
  };
}
