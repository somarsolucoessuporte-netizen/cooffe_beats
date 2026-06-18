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

  const mesa = await prisma.mesa.findFirst({ where: { id, empresaId } });
  if (!mesa) return erroResposta("Mesa não encontrada", 404);

  const pedidos = await prisma.pedido.findMany({
    where: {
      mesaId: id,
      status: { in: ["COMANDA_ABERTA", "AGUARDANDO_PAGAMENTO"] },
    },
    include: {
      itens: {
        include: {
          produto: { select: { nome: true } },
          adicionais: { include: { adicional: { select: { nome: true } } } },
        },
      },
    },
    orderBy: { criadoEm: "asc" },
  });

  return resposta(pedidos);
}
