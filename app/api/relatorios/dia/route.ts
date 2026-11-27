import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";
import { recebimentosDivididos } from "@/lib/dividir-conta/relatorios";
import { diaSP, intervaloDias } from "@/lib/fuso";
import { somarPorMetodo } from "@/lib/metodos-pagamento";

export async function GET(req: Request) {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { searchParams } = new URL(req.url);
  const dataParam = searchParams.get("data");

  const dia = dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam) ? dataParam : diaSP();
  const { inicio, fim } = intervaloDias(dia);
  const divisao = await recebimentosDivididos(empresaId, { inicio, fim });

  const pedidos = await prisma.pedido.findMany({
    where: {
      empresaId,
      criadoEm: { gte: inicio, lte: fim },
      status: { notIn: ["CANCELADO", "AGUARDANDO_PAGAMENTO"] },
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
  const s = somarPorMetodo(pedidos);
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
    data: dia,
    totalPedidos: pedidos.length,
    cancelados,
    totalVendas,
    totalPix: s.pixQr + s.pixCnpj + divisao.totalPix,
    totalCartao: s.credito + s.debito + s.prepago + divisao.totalCartao,
    totalCredito: s.credito + divisao.totalCredito,
    totalDebito: s.debito + divisao.totalDebito,
    totalPrepago: s.prepago + divisao.totalPrepago,
    totalPixQr: s.pixQr + divisao.totalPixQr,
    totalPixCnpj: s.pixCnpj + divisao.totalPixCnpj,
    qtdSemConciliacao: s.qtdSemConciliacao,
    totalSemConciliacao: s.semConciliacao,
    totalDinheiro: s.dinheiro,
    totalSimulado,
    topProdutos,
    extrato,
    divisao,
  });
}
