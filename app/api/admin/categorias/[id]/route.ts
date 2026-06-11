import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getAdminSession } from "@/lib/admin-auth";

const CategoriaUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  emoji: z.string().optional(),
  ordem: z.number().optional(),
  ativo: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  try {
    const body = await req.json();
    const validacao = CategoriaUpdateSchema.safeParse(body);
    if (!validacao.success) return erroResposta(validacao.error.message);

    const result = await prisma.categoria.updateMany({
      where: { id, empresaId: empresaId! },
      data: validacao.data,
    });
    if (result.count === 0) return erroResposta("Categoria não encontrada", 404);

    const atualizada = await prisma.categoria.findUnique({ where: { id } });
    return resposta(atualizada);
  } catch {
    return erroResposta("Erro ao atualizar categoria", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  try {
    const result = await prisma.categoria.updateMany({
      where: { id, empresaId: empresaId! },
      data: { ativo: false },
    });
    if (result.count === 0) return erroResposta("Categoria não encontrada", 404);
    return resposta({ deleted: true });
  } catch {
    return erroResposta("Erro ao desativar categoria", 500);
  }
}
