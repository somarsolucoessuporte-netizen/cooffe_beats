import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

type Params = { params: Promise<{ produtoId: string }> };

// GET — retorna ficha técnica do produto
export async function GET(_req: NextRequest, { params }: Params) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { produtoId } = await params;

  const ficha = await prisma.fichaTecnicaItem.findMany({
    where:   { produtoId },
    include: { insumo: true },
    orderBy: { insumo: { nome: "asc" } },
  });

  return resposta(ficha.map(function (f) {
    return { ...f, quantidade: Number(f.quantidade) };
  }));
}

// POST — adiciona ou atualiza item na ficha técnica (upsert)
export async function POST(req: NextRequest, { params }: Params) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { produtoId } = await params;
  const body = await req.json() as { insumoId: string; quantidade: number };

  if (!body.insumoId || body.quantidade == null) {
    return erroResposta("insumoId e quantidade são obrigatórios");
  }

  const item = await prisma.fichaTecnicaItem.upsert({
    where:   { produtoId_insumoId: { produtoId, insumoId: body.insumoId } },
    update:  { quantidade: body.quantidade },
    create:  { produtoId, insumoId: body.insumoId, quantidade: body.quantidade },
    include: { insumo: true },
  });

  return resposta(item, 201);
}

// DELETE — remove item da ficha técnica
export async function DELETE(req: NextRequest, { params }: Params) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { produtoId } = await params;
  const insumoId = req.nextUrl.searchParams.get("insumoId");

  if (!insumoId) return erroResposta("insumoId obrigatório como query param");

  await prisma.fichaTecnicaItem.delete({
    where: { produtoId_insumoId: { produtoId, insumoId } },
  });

  return resposta({ ok: true });
}
