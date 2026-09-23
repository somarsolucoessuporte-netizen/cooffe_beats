import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresaId");
  if (!empresaId) {
    return NextResponse.json({ ok: false, error: "empresaId obrigatório" }, { status: 400 });
  }

  // Inclui RECEBIDO (mesmo conjunto do KDS) para a senha aparecer no visor assim que o
  // cliente vê a confirmação. RECEBIDO limitado às últimas 12h pra não exibir pedidos abandonados.
  const desde = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const pedidos = await prisma.pedido.findMany({
    where: {
      empresaId,
      OR: [
        { status: { in: ["EM_PREPARO", "PRONTO"] } },
        { status: "RECEBIDO", criadoEm: { gte: desde } },
      ],
    },
    select: { id: true, senha: true, status: true, criadoEm: true },
    orderBy: { criadoEm: "asc" },
  });

  return NextResponse.json({ ok: true, data: pedidos });
}
