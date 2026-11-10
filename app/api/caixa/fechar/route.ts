import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db, estruturaPronta } from "@/lib/dividir-conta/database";

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
  if (await estruturaPronta()) {
    const pendentes = await db.query(`SELECT c.id FROM "ContaDividida" c JOIN "Pedido" p ON p.id=c."pedidoId" WHERE p."caixaId"=$1 AND c.status NOT IN ('QUITADA','CANCELADA') LIMIT 1`, [caixa.id]);
    if (pendentes.length) return erroResposta("Há divisão de conta pendente ou em revisão neste caixa", 409);
  }

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
