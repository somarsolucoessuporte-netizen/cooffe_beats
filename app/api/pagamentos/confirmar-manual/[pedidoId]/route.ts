import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/pagamentos/confirmar-manual/[pedidoId]
 * Fallback manual para quando o webhook do SumUp não chega a tempo no totem:
 * o operador confirma visualmente que a maquininha aprovou e o totem avança
 * como se o webhook tivesse chegado. Protegida contra dupla confirmação —
 * só altera o pagamento se ele ainda estiver PENDENTE.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> },
) {
  const { pedidoId } = await params;

  try {
    const pagamento = await prisma.pagamento.findUnique({
      where:  { pedidoId },
      select: { status: true },
    });

    if (!pagamento) {
      return NextResponse.json({ ok: false, error: "Pedido ou pagamento não encontrado" }, { status: 404 });
    }

    if (pagamento.status === "APROVADO") {
      return NextResponse.json({ ok: true, jaAprovado: true });
    }

    if (pagamento.status !== "PENDENTE") {
      return NextResponse.json(
        { ok: false, error: `Pagamento não pode ser confirmado (status: ${pagamento.status})` },
        { status: 409 },
      );
    }

    await prisma.$transaction([
      prisma.pagamento.update({
        where: { pedidoId },
        data:  {
          status: "APROVADO",
          paidAt: new Date(),
          confirmadoManualmente: true,
        },
      }),
      prisma.pedido.update({
        where: { id: pedidoId },
        data:  { pago: true },
      }),
    ]);

    return NextResponse.json({ ok: true, jaAprovado: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao confirmar pagamento manualmente";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
