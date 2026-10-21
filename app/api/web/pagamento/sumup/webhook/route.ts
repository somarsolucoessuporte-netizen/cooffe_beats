import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { criarPedidoDaSessao } from "@/lib/checkout-sessao";
import { validarAssinaturaWebhook } from "@/lib/sumup-web";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Valida assinatura HMAC-SHA256 (se affiliateKey configurada)
    const signature = req.headers.get("x-payload-signature-sha256") ??
                      req.headers.get("x-webhook-signature") ?? "";

    const configSumup = await prisma.configuracao.findUnique({
      where:  { empresaId: EMPRESA_ID },
      select: { sumupAffiliateKey: true },
    });

    if (configSumup?.sumupAffiliateKey && signature) {
      if (!validarAssinaturaWebhook(rawBody, signature, configSumup.sumupAffiliateKey)) {
        console.error("[Webhook SumUp Web] Assinatura inválida");
        return Response.json({ ok: false }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody) as Record<string, unknown>;

    // SumUp pode enviar o payload direto ou dentro de body.payload
    const payload   = (body.payload ?? body) as Record<string, unknown>;
    const status    = (payload.status ?? body.status) as string | undefined;
    const checkoutRef = (payload.checkout_reference ?? body.checkout_reference) as string | undefined;

    // Responde 200 mesmo se não for PAID (para SumUp não retentar)
    if (status !== "PAID" && status !== "SUCCESSFUL") {
      return Response.json({ ok: true });
    }
    if (!checkoutRef) {
      console.error("[Webhook SumUp Web] checkout_reference ausente");
      return Response.json({ ok: true });
    }

    // Cria o pedido pago (idempotente: sessão já PAGO não gera outro pedido)
    await criarPedidoDaSessao(checkoutRef, { metodo: "PIX", payload: body as object });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[Webhook SumUp Web]", err);
    return Response.json({ ok: false }); // não retornar 5xx para SumUp não retentar
  }
}
