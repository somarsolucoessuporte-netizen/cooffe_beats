import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.status === "PAID" && body.checkout_reference) {
      await prisma.pagamento.updateMany({
        where: { referencia: body.checkout_reference },
        data: {
          status: "APROVADO",
          paidAt: new Date(),
          payload: body as object,
        },
      });

      // Atualizar pedido para RECEBIDO se estiver PENDENTE
      const pagamento = await prisma.pagamento.findFirst({
        where: { referencia: body.checkout_reference },
        select: { pedidoId: true },
      });
      if (pagamento) {
        await prisma.pedido.updateMany({
          where: { id: pagamento.pedidoId, status: "RECEBIDO" },
          data: { status: "RECEBIDO" },
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[SumUp Webhook]", err);
    // Responder 200 mesmo em erro para o SumUp não retentar
    return Response.json({ ok: false });
  }
}
