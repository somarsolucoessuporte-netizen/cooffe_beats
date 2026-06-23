import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

/**
 * POST /api/admin/estoque/baixa-automatica
 * Chamado internamente (fire-and-forget) após criação de pedido.
 * Desconta do estoque os insumos usados em cada produto via ficha técnica.
 * Produtos sem ficha técnica são ignorados silenciosamente.
 * Estoque nunca vai negativo — apenas emite alerta via log.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { pedidoId: string };
    if (!body.pedidoId) return erroResposta("pedidoId obrigatório");

    // Busca pedido com itens e produtos
    const pedido = await prisma.pedido.findUnique({
      where:   { id: body.pedidoId },
      include: { itens: { include: { produto: true } } },
    });

    if (!pedido) return erroResposta("Pedido não encontrado", 404);

    // Para cada item do pedido, busca a ficha técnica do produto
    for (var item of pedido.itens) {
      var fichaItens = await prisma.fichaTecnicaItem.findMany({
        where:   { produtoId: item.produtoId },
        include: { insumo: true },
      });

      if (fichaItens.length === 0) continue; // sem ficha → ignora

      for (var fichaItem of fichaItens) {
        var qtdConsumida = Number(fichaItem.quantidade) * item.quantidade;
        var insumoAtual  = Number(fichaItem.insumo.estoqueAtual);
        var novoEstoque  = Math.max(0, insumoAtual - qtdConsumida); // nunca negativo
        var custoTotal   = Number(fichaItem.insumo.custo) * qtdConsumida;

        await prisma.$transaction([
          prisma.movimentacaoEstoque.create({
            data: {
              empresaId:  EMPRESA_ID,
              insumoId:   fichaItem.insumoId,
              tipo:       "SAIDA",
              quantidade: qtdConsumida,
              custo:      custoTotal,
              origem:     "VENDA",
              pedidoId:   pedido.id,
              observacao: `Pedido ${pedido.senha} — ${item.produto.nome} x${item.quantidade}`,
            },
          }),
          prisma.insumo.update({
            where: { id: fichaItem.insumoId },
            data:  { estoqueAtual: novoEstoque },
          }),
        ]);

        // Alerta silencioso: registra log se abaixo do mínimo
        if (novoEstoque < Number(fichaItem.insumo.estoqueMinimo)) {
          console.warn(
            `[Estoque] Insumo "${fichaItem.insumo.nome}" abaixo do mínimo: ` +
            `${novoEstoque.toFixed(3)} ${fichaItem.insumo.unidade} ` +
            `(mínimo: ${fichaItem.insumo.estoqueMinimo})`
          );
        }
      }
    }

    return resposta({ ok: true, pedidoId: body.pedidoId });
  } catch (err) {
    // Nunca bloqueia o fluxo principal — apenas loga o erro
    console.error("[baixa-automatica]", err);
    return resposta({ ok: false });
  }
}
