import { NextRequest } from "next/server";
import { verificarPagamentoPoint, consultarPagamentoMp, validarAssinaturaWebhook } from "@/lib/mercadopago";
import { aplicarResultadoMp } from "@/lib/mp-pagamento";

/**
 * POST /api/pagamentos/mp/webhook
 * Notificação de "Integrações Point" (intenção) ou "Pagamentos" do Mercado Pago.
 * O payload só serve para achar o id — o status real é sempre reconsultado na API.
 */
export async function POST(req: NextRequest) {
  try {
    const body   = await req.json().catch(() => ({}));
    const dataId = req.nextUrl.searchParams.get("data.id") ?? req.nextUrl.searchParams.get("id");

    const assinaturaOk = validarAssinaturaWebhook({
      xSignature: req.headers.get("x-signature"),
      xRequestId: req.headers.get("x-request-id"),
      dataId,
    });
    if (!assinaturaOk) {
      console.warn("[MP Webhook] x-signature inválida");
      return Response.json({ ok: false }, { status: 401 });
    }

    const topico = (body.type ?? body.topic ?? req.nextUrl.searchParams.get("type") ?? req.nextUrl.searchParams.get("topic")) as string | undefined;
    if (topico === "merchant_order") return Response.json({ ok: true });

    // Formatos aceitos: { id, state, ... } (Point) ou { data: { id } } (padrão)
    const id = (body.data?.id ?? body.id ?? dataId) as string | number | undefined;
    if (!id) return Response.json({ ok: true });

    // Tópico "payment": fallback quando a notificação da intenção não chega
    // (ex.: Point mostrou aviso de cobrança repetida). Acha o Pagamento pelo
    // external_reference, que é a nossa referência.
    if (topico === "payment") {
      const resultado = await consultarPagamentoMp(String(id));
      if (!resultado.referencia) {
        console.warn("[MP Webhook] payment sem external_reference:", id);
        return Response.json({ ok: true });
      }
      await aplicarResultadoMp(resultado.referencia, resultado, { provider: "mercadopago", ...resultado, evento: body });
      return Response.json({ ok: true });
    }

    const resultado = await verificarPagamentoPoint(String(id));
    if (!resultado.referencia) {
      console.warn("[MP Webhook] intenção sem external_reference:", id);
      return Response.json({ ok: true });
    }
    await aplicarResultadoMp(resultado.referencia, resultado, {
      provider: "mercadopago", paymentIntentId: String(id), ...resultado, evento: body,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[MP Webhook]", err);
    // 500 faz o Mercado Pago retentar a entrega
    return Response.json({ ok: false }, { status: 500 });
  }
}
