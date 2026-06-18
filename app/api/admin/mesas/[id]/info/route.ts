import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

// Rota pública — retorna apenas numero e nome da mesa (para a tela do cliente)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const mesa = await prisma.mesa.findUnique({
    where: { id },
    select: { numero: true, nome: true, ativo: true, modoPagamento: true },
  });

  if (!mesa || !mesa.ativo) return erroResposta("Mesa não encontrada", 404);
  return resposta(mesa);
}
