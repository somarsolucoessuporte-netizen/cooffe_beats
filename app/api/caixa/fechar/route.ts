import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return erroResposta("Não autenticado", 401);

  const user = session.user as { empresaId?: string; perfil?: string };
  const empresaId = user.empresaId;
  if (!empresaId) return erroResposta("Sessão inválida", 401);

  const caixa = await prisma.caixa.findFirst({
    where: { empresaId, status: "ABERTO" },
  });
  if (!caixa) return erroResposta("Nenhum caixa aberto encontrado", 404);

  const body = await req.json().catch(() => ({}));

  // Calcula totais do período
  const pedidos = await prisma.pedido.findMany({
    where: {
      empresaId,
      caixaId: caixa.id,
      status: { notIn: ["CANCELADO"] },
    },
    include: { pagamento: true },
  });

  const totalVendas = pedidos.reduce((acc, p) => acc + Number(p.total), 0);

  const caixaFechado = await prisma.caixa.update({
    where: { id: caixa.id },
    data: {
      status: "FECHADO",
      valorFechamento: body.valorFechamento != null ? Number(body.valorFechamento) : totalVendas,
      observacao: body.observacao ?? null,
      fechadoEm: new Date(),
    },
    include: { usuario: { select: { nome: true } } },
  });

  return resposta({ caixa: caixaFechado, totalPedidos: pedidos.length, totalVendas });
}
