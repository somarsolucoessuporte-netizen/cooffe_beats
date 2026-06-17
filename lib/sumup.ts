const SUMUP_API = "https://api.sumup.com";

export async function getSumupToken(): Promise<string> {
  const res = await fetch(`${SUMUP_API}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     process.env.SUMUP_CLIENT_ID!,
      client_secret: process.env.SUMUP_CLIENT_SECRET!,
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error("SumUp: falha ao obter token: " + JSON.stringify(data));
  }
  return data.access_token as string;
}

export async function criarCheckout(params: {
  valor: number;
  descricao: string;
  referencia: string;
}): Promise<{ id: string; checkout_reference: string; checkout_url?: string; status: string }> {
  const token = await getSumupToken();
  const res = await fetch(`${SUMUP_API}/v0.1/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      checkout_reference: params.referencia,
      amount:            params.valor,
      currency:          "BRL",
      merchant_code:     process.env.SUMUP_MERCHANT_CODE,
      description:       params.descricao,
      return_url:        `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/pagamentos/sumup/callback`,
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!data.id) {
    throw new Error("SumUp: falha ao criar checkout: " + JSON.stringify(data));
  }
  return data;
}

export async function verificarCheckout(checkoutId: string): Promise<{
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  transaction_code?: string;
}> {
  const token = await getSumupToken();
  const res = await fetch(`${SUMUP_API}/v0.1/checkouts/${checkoutId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json();
  return {
    status:           data.status as "PENDING" | "PAID" | "FAILED" | "EXPIRED",
    transaction_code: data.transaction_code ?? undefined,
  };
}
