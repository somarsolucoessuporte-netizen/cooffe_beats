import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getAdminSession } from "@/lib/admin-auth";

const ProdutoUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().optional(),
  preco: z.number().positive().optional(),
  categoriaId: z.string().optional(),
  fotoUrl: z.string().nullable().optional(),
  destaque: z.boolean().optional(),
  disponivel: z.boolean().optional(),
  ordem: z.number().optional(),
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
    const validacao = ProdutoUpdateSchema.safeParse(body);
    if (!validacao.success) return erroResposta(validacao.error.message);

    const result = await prisma.produto.updateMany({
      where: { id, empresaId: empresaId! },
      data: validacao.data,
    });
    if (result.count === 0) return erroResposta("Produto não encontrado", 404);

    const atualizado = await prisma.produto.findUnique({
      where: { id },
      include: { categoria: true },
    });
    return resposta(atualizado);
  } catch {
    return erroResposta("Erro ao atualizar produto", 500);
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
    const result = await prisma.produto.updateMany({
      where: { id, empresaId: empresaId! },
      data: { disponivel: false },
    });
    if (result.count === 0) return erroResposta("Produto não encontrado", 404);
    return resposta({ deleted: true });
  } catch {
    return erroResposta("Erro ao excluir produto", 500);
  }
}
