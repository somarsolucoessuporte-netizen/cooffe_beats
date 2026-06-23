import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

interface ItemConfirmacao {
  insumoId:   string;
  quantidade: number;
  custo:      number; // custo total do item (valorTotal da NF-e)
}

/**
 * POST /api/admin/estoque/nfe/confirmar
 * Recebe o mapeamento item-da-nota → insumo e cria as movimentações de ENTRADA.
 * Chamado pelo admin após confirmar o mapeamento na tela de NF-e.
 */
export async function POST(req: NextRequest) {
  const { erro, perfil } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const body = await req.json() as {
    nfeChave?: string;
    fornecedor?: string;
    itens: ItemConfirmacao[];
  };

  if (!Array.isArray(body.itens) || body.itens.length === 0) {
    return erroResposta("itens é obrigatório e deve ter ao menos um mapeamento");
  }

  // Valida que todos os insumos existem
  const insumoIds = [...new Set(body.itens.map(function (i) { return i.insumoId; }))];
  const insumos   = await prisma.insumo.findMany({ where: { id: { in: insumoIds } } });
  if (insumos.length !== insumoIds.length) return erroResposta("Um ou mais insumos não encontrados");

  const insumoMap: Record<string, typeof insumos[0]> = {};
  for (var ins of insumos) insumoMap[ins.id] = ins;

  // Cria movimentações de ENTRADA e atualiza estoques em transação
  const operacoes = body.itens.flatMap(function (item) {
    var custoUnit = item.custo / item.quantidade;
    return [
      prisma.movimentacaoEstoque.create({
        data: {
          empresaId:  EMPRESA_ID,
          insumoId:   item.insumoId,
          tipo:       "ENTRADA",
          quantidade: item.quantidade,
          custo:      item.custo,
          origem:     "NFE",
          nfeChave:   body.nfeChave   ?? null,
          observacao: body.fornecedor ? `NF-e: ${body.fornecedor}` : null,
          criadoPor:  perfil ?? null,
        },
      }),
      // Atualiza custo unitário do insumo com a média ponderada (ou substitui)
      prisma.insumo.update({
        where: { id: item.insumoId },
        data:  {
          estoqueAtual: { increment: item.quantidade },
          custo:        custoUnit, // atualiza custo conforme última compra
        },
      }),
    ];
  });

  await prisma.$transaction(operacoes);

  return resposta({ ok: true, entradas: body.itens.length });
}
