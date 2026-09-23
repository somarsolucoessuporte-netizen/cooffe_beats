import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/pagamentos/cancelar/[pedidoId]
 * Cliente desistiu (ou o tempo expirou) na tela de aguardo PIX/cartão do totem.
 * O pedido ainda está AGUARDANDO_PAGAMENTO — nunca entrou no KDS — e vira CANCELADO.
 * Se o pagamento já foi aprovado nesse meio tempo, não cancela.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> },
) {
  const { pedidoId } = await params;

  try {
    const pagamento = await prisma.pagamento.findUnique({
      where:  { pedidoId },
      select: { status: true },
    });

    if (pagamento?.status === "APROVADO") {
      return NextResponse.json({ ok: false, jaAprovado: true, error: "Pagamento já aprovado" }, { status: 409 });
    }

    const cancelado = await prisma.pedido.updateMany({
      where: { id: pedidoId, status: "AGUARDANDO_PAGAMENTO" },
      data:  { status: "CANCELADO" },
    });

    if (cancelado.count > 0) {
      await prisma.pagamento.updateMany({
        where: { pedidoId, status: "PENDENTE" },
        data:  { status: "CANCELADO" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao cancelar pagamento";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
