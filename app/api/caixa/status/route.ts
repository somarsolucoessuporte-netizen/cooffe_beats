import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  // Admin/staff logado usa a empresa da sessão; totem anônimo manda ?empresaId=
  const empresaId = session?.user
    ? (session.user as { empresaId?: string }).empresaId
    : req.nextUrl.searchParams.get("empresaId") ?? undefined;

  if (!empresaId) return erroResposta("Não autenticado", 401);

  const caixa = await prisma.caixa.findFirst({
    where: { empresaId, status: "ABERTO" },
    include: {
      usuario: { select: { nome: true } },
      pedidos: {
        where: { status: { notIn: ["CANCELADO"] } },
        include: { pagamento: true },
      },
    },
    orderBy: { abridoEm: "desc" },
  });

  if (!caixa) return resposta({ aberto: false, caixa: null });

  const totalVendas   = caixa.pedidos.reduce((acc, p) => acc + Number(p.total), 0);
  const totalPix      = caixa.pedidos.filter(p => p.pagamento?.metodo === "PIX").reduce((acc, p) => acc + Number(p.total), 0);
  const totalCartao   = caixa.pedidos.filter(p => ["CARTAO_CREDITO","CARTAO_DEBITO"].includes(p.pagamento?.metodo ?? "")).reduce((acc, p) => acc + Number(p.total), 0);
  const totalDinheiro = caixa.pedidos.filter(p => p.pagamento?.metodo === "DINHEIRO").reduce((acc, p) => acc + Number(p.total), 0);
  const ticketMedio   = caixa.pedidos.length > 0 ? totalVendas / caixa.pedidos.length : 0;

  return resposta({
    aberto: true,
    caixa: {
      id:            caixa.id,
      abridoEm:      caixa.abridoEm,
      valorAbertura: Number(caixa.valorAbertura),
      operador:      caixa.usuario?.nome ?? caixa.operadorNome ?? "—",
    },
    resumo: {
      totalPedidos: caixa.pedidos.length,
      totalVendas,
      totalPix,
      totalCartao,
      totalDinheiro,
      ticketMedio,
    },
  });
}
