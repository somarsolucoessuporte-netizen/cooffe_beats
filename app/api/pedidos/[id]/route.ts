import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        itens: {
          include: {
            produto: true,
            adicionais: { include: { adicional: true } },
          },
        },
        pagamento: true,
        atendente: { select: { nome: true } },
      },
    });

    if (!pedido) {
      return erroResposta("Pedido não encontrado", 404);
    }

    return resposta(pedido);
  } catch {
    return erroResposta("Erro ao buscar pedido", 500);
  }
}
