import { NextRequest } from "next/server";
import { z } from "zod";
import { resposta, erroResposta } from "@/lib/api-response";

const CriarSchema = z.object({
  valor: z.number().positive(),
  descricao: z.string(),
  referencia: z.string(),
  metodo: z.enum(["PIX", "CARTAO"]),
});

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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CriarSchema.safeParse(body);
  if (!parsed.success) return erroResposta(parsed.error.message);

  const { valor, descricao, referencia, metodo } = parsed.data;

  try {
    const token = await getSumupToken();

    const payload: Record<string, unknown> = {
      checkout_reference: referencia,
      amount: valor,
      currency: "BRL",
      merchant_code: process.env.SUMUP_MERCHANT_CODE,
      description: descricao,
      redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/confirmacao`,
    };

    if (metodo === "PIX") {
      payload.payment_type = "pix";
    }

    const checkoutRes = await fetch("https://api.sumup.com/v0.1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!checkoutRes.ok) {
      const err = await checkoutRes.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message ?? "Erro SumUp");
    }

    const checkout = await checkoutRes.json();

    return resposta({
      checkout_id: checkout.id,
      checkout_url: checkout.checkout_url,
      qr_code: checkout.qr_code ?? null,
      status: checkout.status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar cobrança";
    return erroResposta(msg, 500);
  }
}
