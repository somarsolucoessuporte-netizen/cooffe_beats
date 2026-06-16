export interface SumupCheckout {
  checkout_id: string;
  checkout_url?: string;
  qr_code?: string;
  status: string;
}

export interface SumupStatus {
  status: "PENDING" | "PAID" | "FAILED" | "SUCCESSFUL" | "EXPIRED";
  transaction_id?: string;
}

export async function criarCobranca(dados: {
  valor: number;
  descricao: string;
  referencia: string;
  metodo: "PIX" | "CARTAO";
}): Promise<SumupCheckout> {
  const res = await fetch("/api/pagamentos/sumup/criar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "Erro ao criar cobrança SumUp");
  return json.data as SumupCheckout;
}

export async function verificarPagamento(checkoutId: string): Promise<SumupStatus> {
  const res = await fetch(`/api/pagamentos/sumup/status/${checkoutId}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "Erro ao verificar pagamento");
  return json.data as SumupStatus;
}
