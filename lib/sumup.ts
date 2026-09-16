const SUMUP_API = "https://api.sumup.com";

// Cache do token OAuth2 em memória (por processo Node.js)
let tokenCache: { value: string; expiresAt: number } | null = null;

/**
 * Obtém token de acesso com cache automático e renovação por expiração.
 * Modo 1 (preferencial): OAuth2 client_credentials via SUMUP_CLIENT_ID + SUMUP_CLIENT_SECRET.
 * Modo 2 (fallback):     SUMUP_API_KEY usado diretamente como Bearer token.
 */
export async function getAccessToken(): Promise<string> {
  // Retornar cache se ainda válido (60s de margem para renovação antecipada)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.value;
  }

  const clientId     = process.env.SUMUP_CLIENT_ID;
  const clientSecret = process.env.SUMUP_CLIENT_SECRET;

  if (clientId && clientSecret) {
    try {
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
      const data = await res.json() as {
        access_token?:     string;
        expires_in?:       number;
        error_description?: string;
      };
      if (data.access_token) {
        const ttl = (data.expires_in ?? 3600) * 1000;
        tokenCache = { value: data.access_token, expiresAt: Date.now() + ttl };
        return data.access_token;
      }
      console.warn("[SumUp] OAuth2 falhou:", data.error_description ?? JSON.stringify(data));
    } catch (e) {
      console.warn("[SumUp] OAuth2 exception:", e instanceof Error ? e.message : e);
    }
  }

  // Fallback: API Key direta como Bearer
  const apiKey = process.env.SUMUP_API_KEY;
  if (apiKey) return apiKey;

  throw new Error(
    "SumUp: configure SUMUP_CLIENT_ID + SUMUP_CLIENT_SECRET (ou SUMUP_API_KEY) no .env"
  );
}

// Alias para compatibilidade com /api/pagamentos/sumup/teste
export const getSumupToken = getAccessToken;

// ─── MAQUININHA FÍSICA (Terminal API) ────────────────────────────────────────

export interface SumupReader {
  id:     string;
  name:   string;
  status: string; // "online" | "offline" | outros
  device: { serial_number: string };
}

/** Lista maquininhas registradas no merchant. */
export async function getReaders(): Promise<SumupReader[]> {
  const token        = await getAccessToken();
  const merchantCode = process.env.SUMUP_MERCHANT_CODE;
  if (!merchantCode) throw new Error("SUMUP_MERCHANT_CODE não configurado");

  const res = await fetch(`${SUMUP_API}/v0.1/merchants/${merchantCode}/readers`, {
    headers: { Authorization: `Bearer ${token}` },
    cache:   "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as object;
    throw new Error(`SumUp readers ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  // A API pode retornar array direto ou { items: [...] }
  return Array.isArray(data) ? data : ((data as { items?: SumupReader[] }).items ?? []);
}

/** Envia cobrança diretamente para a maquininha física. */
export async function enviarParaMaquininha(
  readerId:   string,
  valor:      number,
  descricao:  string,
  referencia: string,
): Promise<{ id: string; status: string }> {
  const token = await getAccessToken();

  const res = await fetch(`${SUMUP_API}/v0.1/readers/${readerId}/checkout`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      total_amount: {
        currency:   "BRL",
        minor_unit: Math.round(valor * 100),
      },
      description:        descricao,
      checkout_reference: referencia, // correlaciona com o pedido no webhook
    }),
    cache: "no-store",
  });

  const data = await res.json() as { id?: string; status?: string };
  if (!data.id) {
    throw new Error("SumUp reader checkout falhou: " + JSON.stringify(data));
  }
  return { id: data.id, status: data.status ?? "PENDING" };
}

/** Verifica status de um checkout enviado para maquininha. */
export async function verificarReaderCheckout(
  readerId:   string,
  checkoutId: string,
): Promise<{ status: "PENDING" | "PAID" | "FAILED" | "EXPIRED"; transaction_code?: string }> {
  const token = await getAccessToken();

  const res = await fetch(`${SUMUP_API}/v0.1/readers/${readerId}/checkout/${checkoutId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache:   "no-store",
  });

  const data = await res.json() as { status?: string; transaction_id?: string };
  return {
    status:           normalizarStatusTerminal(data.status),
    transaction_code: data.transaction_id ?? undefined,
  };
}

function normalizarStatusTerminal(s?: string): "PENDING" | "PAID" | "FAILED" | "EXPIRED" {
  switch (s?.toUpperCase()) {
    case "SUCCESSFUL":
    case "PAID":       return "PAID";
    case "FAILED":
    case "CANCELLED":  return "FAILED";
    case "EXPIRED":    return "EXPIRED";
    default:           return "PENDING";
  }
}

// ─── CHECKOUT WEB (fallback para reader offline) ──────────────────────────────

export async function criarCheckout(params: {
  valor:      number;
  descricao:  string;
  referencia: string;
}): Promise<{ id: string; checkout_reference: string; checkout_url?: string; status: string }> {
  const token = await getAccessToken();

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
      // return_url é o mecanismo real de notificação do SumUp (não há endpoint de
      // cadastro de webhook na API pública) — precisa apontar para o webhook, não
      // para uma rota de redirect de navegador.
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/pagamentos/sumup/webhook`,
    }),
    cache: "no-store",
  });

  const data = await res.json() as {
    id?:                 string;
    checkout_reference?: string;
    checkout_url?:       string;
    status?:             string;
  };
  if (!data.id) {
    throw new Error("SumUp checkout web falhou: " + JSON.stringify(data));
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
  checkout_reference?: string;
}> {
  const token = await getAccessToken();

  const res = await fetch(`${SUMUP_API}/v0.1/checkouts/${checkoutId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache:   "no-store",
  });

  const data = await res.json() as {
    status?: string;
    transaction_code?: string;
    checkout_reference?: string;
  };
  return {
    status:             (data.status ?? "PENDING") as "PENDING" | "PAID" | "FAILED" | "EXPIRED",
    transaction_code:   data.transaction_code ?? undefined,
    checkout_reference: data.checkout_reference ?? undefined,
  };
}
