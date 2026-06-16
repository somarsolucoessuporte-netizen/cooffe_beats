import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

export async function GET(req: Request) {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { searchParams } = new URL(req.url);
  const dataParam = searchParams.get("data");

  const data = dataParam ? new Date(dataParam) : new Date();
  const inicio = new Date(data);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(data);
  fim.setHours(23, 59, 59, 999);

  const pedidos = await prisma.pedido.findMany({
    where: {
      empresaId,
      criadoEm: { gte: inicio, lte: fim },
      status: { notIn: ["CANCELADO"] },
    },
    include: {
      pagamento: true,
      itens: {
        include: { produto: { select: { nome: true } } },
      },
    },
    orderBy: { criadoEm: "asc" },
  });

  const totalVendas    = pedidos.reduce((acc, p) => acc + Number(p.total), 0);
  const totalPix       = pedidos.filter(p => p.pagamento?.metodo === "PIX").reduce((acc, p) => acc + Number(p.total), 0);
  const totalCartao    = pedidos.filter(p => ["CARTAO_CREDITO","CARTAO_DEBITO"].includes(p.pagamento?.metodo ?? "")).reduce((acc, p) => acc + Number(p.total), 0);
  const totalDinheiro  = pedidos.filter(p => p.pagamento?.metodo === "DINHEIRO").reduce((acc, p) => acc + Number(p.total), 0);
  const totalSimulado  = pedidos.filter(p => p.pagamento?.metodo === "SIMULADO").reduce((acc, p) => acc + Number(p.total), 0);
  const cancelados     = await prisma.pedido.count({ where: { empresaId, criadoEm: { gte: inicio, lte: fim }, status: "CANCELADO" } });

  // Top 10 produtos
  const produtoMap: Record<string, { nome: string; quantidade: number; total: number }> = {};
  for (const pedido of pedidos) {
    for (const item of pedido.itens) {
      const key = item.produtoId;
      if (!produtoMap[key]) produtoMap[key] = { nome: item.produto.nome, quantidade: 0, total: 0 };
      produtoMap[key].quantidade += item.quantidade;
      produtoMap[key].total += Number(item.precoTotal);
    }
  }
  const topProdutos = Object.values(produtoMap)
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);

  // Extrato simplificado (pedidos listados)
  const extrato = pedidos.map(p => ({
    id:       p.id,
    senha:    p.senha,
    criadoEm: p.criadoEm,
    total:    Number(p.total),
    metodo:   p.pagamento?.metodo ?? null,
    status:   p.status,
  }));

  return resposta({
    data: inicio.toISOString().slice(0, 10),
    totalPedidos: pedidos.length,
    cancelados,
    totalVendas,
    totalPix,
    totalCartao,
    totalDinheiro,
    totalSimulado,
    topProdutos,
    extrato,
  });
}
