import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const produto = await prisma.produto.findUnique({
      where: { id },
      include: {
        categoria: true,
        adicionais: {
          include: { adicional: true },
        },
      },
    });

    if (!produto) {
      return erroResposta("Produto não encontrado", 404);
    }

    return resposta(produto);
  } catch {
    return erroResposta("Erro ao buscar produto", 500);
  }
}
