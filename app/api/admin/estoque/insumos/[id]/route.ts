import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// GET — detalhe do insumo com últimas movimentações
export async function GET(_req: NextRequest, { params }: Params) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { id } = await params;

  const insumo = await prisma.insumo.findUnique({
    where:   { id },
    include: {
      movimentacoes: {
        orderBy: { createdAt: "desc" },
        take:    20,
      },
      fichaTecnica: {
        include: { produto: { select: { nome: true } } },
      },
    },
  });

  if (!insumo) return erroResposta("Insumo não encontrado", 404);
  return resposta(insumo);
}

// PATCH — atualiza insumo
export async function PATCH(req: NextRequest, { params }: Params) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  const update: Record<string, unknown> = {};
  if (body.nome            != null) update.nome            = String(body.nome).trim();
  if (body.unidade         != null) update.unidade         = String(body.unidade).trim();
  if (body.estoqueAtual    != null) update.estoqueAtual    = Number(body.estoqueAtual);
  if (body.estoqueMinimo   != null) update.estoqueMinimo   = Number(body.estoqueMinimo);
  if (body.percentualPerda != null) update.percentualPerda = Number(body.percentualPerda);
  if (body.custo           != null) update.custo           = Number(body.custo);

  const insumo = await prisma.insumo.update({ where: { id }, data: update });
  return resposta(insumo);
}

// DELETE — soft delete (ativo: false)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { erro } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  const { id } = await params;
  await prisma.insumo.update({ where: { id }, data: { ativo: false } });
  return resposta({ ok: true });
}
