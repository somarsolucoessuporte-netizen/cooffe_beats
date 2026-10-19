import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarPagamentoPoint, validarAssinaturaWebhook } from "@/lib/mercadopago";
import { liberarPedidoPago } from "@/lib/liberar-pedido";

/**
 * POST /api/pagamentos/mp/webhook
 * Notificação de "Integrações Point" do Mercado Pago. O payload só serve para
 * achar o id da intenção — o status real é sempre reconsultado na API.
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

    // Notificações de outros tópicos (payment, merchant_order) não são intenções Point
    const topico = (body.type ?? body.topic ?? req.nextUrl.searchParams.get("type") ?? req.nextUrl.searchParams.get("topic")) as string | undefined;
    if (topico === "payment" || topico === "merchant_order") return Response.json({ ok: true });

    // Formatos aceitos: { id, state, ... } (Point) ou { data: { id } } (padrão)
    const intentId = (body.data?.id ?? body.id ?? dataId) as string | undefined;
    if (!intentId) return Response.json({ ok: true });

    const resultado = await verificarPagamentoPoint(String(intentId));
    const referencia = resultado.referencia;

    if (resultado.status === "PAID" && referencia) {
      const result = await prisma.pagamento.updateMany({
        where: { referencia, status: { not: "APROVADO" } },
        data:  {
          status:  "APROVADO",
          paidAt:  new Date(),
          payload: { provider: "mercadopago", paymentIntentId: intentId, ...resultado, evento: body },
        },
      });

      if (result.count > 0) {
        // Pedido do totem nasce AGUARDANDO_PAGAMENTO; aprovado, vai para RECEBIDO e entra no KDS.
        const pagamento = await prisma.pagamento.findFirst({
          where:  { referencia },
          select: { pedidoId: true },
        });
        if (pagamento?.pedidoId) await liberarPedidoPago(pagamento.pedidoId);
      }
    } else if (resultado.status === "FAILED" && referencia) {
      // Recusado/cancelado/erro na Point: o polling do totem vê RECUSADO e volta à escolha.
      // Só mexe em pendentes — cancelamento feito pelo totem já gravou CANCELADO.
      await prisma.pagamento.updateMany({
        where: { referencia, status: "PENDENTE" },
        data:  {
          status:  "RECUSADO",
          payload: { provider: "mercadopago", paymentIntentId: intentId, ...resultado, evento: body },
        },
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[MP Webhook]", err);
    // 500 faz o Mercado Pago retentar a entrega
    return Response.json({ ok: false }, { status: 500 });
  }
}
