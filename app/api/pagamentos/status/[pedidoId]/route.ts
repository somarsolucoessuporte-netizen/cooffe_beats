import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Lê o status já gravado no banco (fonte de verdade: webhook do SumUp).
// Usado pelo polling do totem como fallback de UX — não consulta o SumUp diretamente.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> },
) {
  const { pedidoId } = await params;

  const pagamento = await prisma.pagamento.findUnique({
    where:  { pedidoId },
    select: { status: true },
  });

  if (!pagamento) {
    return NextResponse.json({ ok: false, error: "Pagamento não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, status: pagamento.status });
}
