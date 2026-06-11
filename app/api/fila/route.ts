import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresaId");
  if (!empresaId) {
    return NextResponse.json({ ok: false, error: "empresaId obrigatório" }, { status: 400 });
  }

  const pedidos = await prisma.pedido.findMany({
    where: { empresaId, status: { in: ["EM_PREPARO", "PRONTO"] } },
    select: { id: true, senha: true, status: true, criadoEm: true },
    orderBy: { criadoEm: "asc" },
  });

  return NextResponse.json({ ok: true, data: pedidos });
}
