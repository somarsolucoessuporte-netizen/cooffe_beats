import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { id } = await params;

  const mesa = await prisma.mesa.findFirst({ where: { id, empresaId } });
  if (!mesa) return erroResposta("Mesa não encontrada", 404);

  const pedidosAbertos = await prisma.pedido.findMany({
    where: { mesaId: id, status: "COMANDA_ABERTA" },
    select: { id: true, total: true },
  });

  if (pedidosAbertos.length === 0)
    return erroResposta("Nenhuma comanda aberta nesta mesa", 404);

  const total = pedidosAbertos.reduce(function(sum, p) { return sum + Number(p.total); }, 0);

  await prisma.pedido.updateMany({
    where: { mesaId: id, status: "COMANDA_ABERTA" },
    data: { status: "AGUARDANDO_PAGAMENTO" },
  });

  return resposta({ total, pedidos: pedidosAbertos.length });
}
