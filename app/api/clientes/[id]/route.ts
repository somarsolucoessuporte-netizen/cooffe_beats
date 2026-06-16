import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { id } = await params;

  const cliente = await prisma.cliente.findFirst({
    where: { id, empresaId },
    include: {
      pedidos: {
        orderBy: { criadoEm: "desc" },
        take: 20,
        include: {
          pagamento: true,
          itens: { include: { produto: { select: { nome: true } } } },
        },
      },
    },
  });

  if (!cliente) return erroResposta("Cliente não encontrado", 404);
  return resposta(cliente);
}
