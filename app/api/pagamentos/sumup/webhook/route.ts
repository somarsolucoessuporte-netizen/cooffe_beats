import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarCheckout } from "@/lib/sumup";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let status:     string | undefined;
    let referencia: string | undefined;
    let payloadParaSalvar: object = body;

    // return_url do checkout web dispara um evento "magro": { event_type, id }.
    // Não confiamos nesse payload — buscamos o status real na API do SumUp.
    const ehEventoMagro = typeof body.id === "string" && body.payload === undefined && body.checkout_reference === undefined;

    if (ehEventoMagro) {
      const checkout = await verificarCheckout(body.id as string);
      status            = checkout.status;
      referencia        = checkout.checkout_reference;
      payloadParaSalvar = { ...body, checkoutVerificado: checkout };
    } else {
      // Normaliza status e referência independente do formato do evento:
      // - checkout web:   { status, checkout_reference }
      // - terminal:       { event_type: "payment.successful", payload: { status, checkout_reference } }
      status     = (body.status     ?? body.payload?.status)              as string | undefined;
      referencia = (body.checkout_reference ?? body.payload?.checkout_reference) as string | undefined;
    }

    const pago = status === "PAID" || status === "SUCCESSFUL";

    if (pago && referencia) {
      const result = await prisma.pagamento.updateMany({
        where: { referencia },
        data:  {
          status:  "APROVADO",
          paidAt:  new Date(),
          payload: payloadParaSalvar,
        },
      });

      if (result.count === 0) {
        console.warn("[Webhook SumUp] Pagamento não encontrado para referencia:", referencia);
      } else {
        // StatusPedido não tem valor "PAGO" — o pedido do totem já nasce RECEBIDO
        // (app/api/pedidos/route.ts) para o KDS pegar via Realtime independente do
        // pagamento; a confirmação financeira usa o campo booleano `pago`.
        const pagamento = await prisma.pagamento.findFirst({
          where:  { referencia },
          select: { pedidoId: true },
        });
        if (pagamento?.pedidoId) {
          await prisma.pedido.update({
            where: { id: pagamento.pedidoId },
            data:  { pago: true },
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[SumUp Webhook]", err);
    // Responde 200 mesmo em erro para o SumUp não retentar a entrega
    return Response.json({ ok: false });
  }
}
