import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

/**
 * GET /api/admin/estoque/relatorios/cmv
 * Params: dataInicio (ISO), dataFim (ISO)
 * Retorna CMV (Custo da Mercadoria Vendida) do período.
 */
export async function GET(req: NextRequest) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const p          = req.nextUrl.searchParams;
  const dataInicio = p.get("dataInicio");
  const dataFim    = p.get("dataFim");

  if (!dataInicio || !dataFim) return erroResposta("dataInicio e dataFim são obrigatórios");

  const inicio = new Date(dataInicio);
  const fim    = new Date(dataFim);
  fim.setHours(23, 59, 59, 999);

  // Busca movimentações do período
  const movimentacoes = await prisma.movimentacaoEstoque.findMany({
    where: {
      empresaId: EMPRESA_ID,
      createdAt: { gte: inicio, lte: fim },
    },
    include: { insumo: { select: { nome: true, unidade: true, custo: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Faturamento do período (pedidos não cancelados)
  const pedidos = await prisma.pedido.findMany({
    where: {
      empresaId: EMPRESA_ID,
      criadoEm:  { gte: inicio, lte: fim },
      status:    { not: "CANCELADO" },
    },
    select: { total: true },
  });

  var faturamento = pedidos.reduce(function (s, p) { return s + Number(p.total); }, 0);

  // Agrupamentos
  var custoEntradas = 0;
  var custoSaidas   = 0;
  var custoPerdas   = 0;
  var custoAjustes  = 0;

  // Desperdício por insumo
  var desperdicoPorInsumo: Record<string, { nome: string; unidade: string; custo: number; quantidade: number }> = {};

  for (var m of movimentacoes) {
    var custo = Number(m.custo ?? 0);
    switch (m.tipo) {
      case "ENTRADA": custoEntradas += custo; break;
      case "SAIDA":   custoSaidas   += custo; break;
      case "PERDA":
        custoPerdas += custo;
        if (!desperdicoPorInsumo[m.insumoId]) {
          desperdicoPorInsumo[m.insumoId] = { nome: m.insumo.nome, unidade: m.insumo.unidade, custo: 0, quantidade: 0 };
        }
        desperdicoPorInsumo[m.insumoId].custo     += custo;
        desperdicoPorInsumo[m.insumoId].quantidade += Number(m.quantidade);
        break;
      case "AJUSTE":
        if (Number(m.quantidade) < 0) custoPerdas += Math.abs(custo);
        custoAjustes += custo;
        break;
    }
  }

  // CMV = custo das saídas por venda + perdas
  var cmv       = custoSaidas + custoPerdas;
  var cmvPerc   = faturamento > 0 ? (cmv / faturamento) * 100 : 0;

  // Top 5 insumos com maior desperdício
  var ranking = Object.values(desperdicoPorInsumo)
    .sort(function (a, b) { return b.custo - a.custo; })
    .slice(0, 5);

  return resposta({
    periodo:        { inicio: dataInicio, fim: dataFim },
    faturamento,
    custoEntradas,
    custoSaidas,
    custoPerdas,
    custoAjustes,
    cmv,
    cmvPerc:        parseFloat(cmvPerc.toFixed(2)),
    topDesperdicio: ranking,
    movimentacoes,
  });
}
