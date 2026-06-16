import { NextRequest } from "next/server";
import { resposta, erroResposta } from "@/lib/api-response";

async function getSumupToken(): Promise<string> {
  const res = await fetch("https://api.sumup.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SUMUP_CLIENT_ID!,
      client_secret: process.env.SUMUP_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error("Falha na autenticação SumUp");
  const data = await res.json();
  return data.access_token as string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const token = await getSumupToken();
    const res = await fetch(`https://api.sumup.com/v0.1/checkouts/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return erroResposta("Checkout não encontrado", 404);
    }

    const data = await res.json();

    // Mapear status SumUp → status interno
    let status: "PENDING" | "PAID" | "FAILED" = "PENDING";
    if (data.status === "PAID") status = "PAID";
    else if (data.status === "FAILED" || data.status === "EXPIRED") status = "FAILED";

    return resposta({ status, transaction_id: data.transaction_code ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao verificar status";
    return erroResposta(msg, 500);
  }
}
