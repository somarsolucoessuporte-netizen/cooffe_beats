import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";
type Params = { params: Promise<{ id: string }> };

// GET — retorna inventário com todos os itens
export async function GET(_req: NextRequest, { params }: Params) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { id } = await params;

  const inventario = await prisma.inventario.findUnique({
    where:   { id },
    include: {
      itens: {
        include: { insumo: true },
        orderBy: { insumo: { nome: "asc" } },
      },
    },
  });

  if (!inventario) return erroResposta("Inventário não encontrado", 404);
  return resposta(inventario);
}

// PATCH — finaliza inventário: recebe contagens reais e ajusta estoque
export async function PATCH(req: NextRequest, { params }: Params) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { id } = await params;

  const inventario = await prisma.inventario.findUnique({
    where:   { id },
    include: { itens: { include: { insumo: true } } },
  });

  if (!inventario)              return erroResposta("Inventário não encontrado", 404);
  if (inventario.status !== "ABERTO") return erroResposta("Inventário já finalizado");

  // Body: { itens: [{ id: InventarioItemId, estoqueReal: number }] }
  const body = await req.json() as { itens: { id: string; estoqueReal: number }[] };
  if (!Array.isArray(body.itens)) return erroResposta("itens é obrigatório");

  // Mapa id → estoqueReal enviado pelo frontend
  const realMap: Record<string, number> = {};
  for (var entry of body.itens) {
    realMap[entry.id] = Number(entry.estoqueReal);
  }

  const ops: ReturnType<typeof prisma.inventarioItem.update>[] = [];
  const ajustes: ReturnType<typeof prisma.movimentacaoEstoque.create>[] = [];
  const atualizacoes: ReturnType<typeof prisma.insumo.update>[] = [];

  for (var item of inventario.itens) {
    var real    = realMap[item.id] ?? Number(item.estoqueReal);
    var teorico = Number(item.estoqueTeorico);
    var variacao = real - teorico;
    var variacaoPerc = teorico > 0 ? (variacao / teorico) * 100 : 0;
    var dentro  = Math.abs(variacaoPerc) <= Number(item.insumo.percentualPerda);

    // Atualiza item do inventário
    ops.push(
      prisma.inventarioItem.update({
        where: { id: item.id },
        data:  { estoqueReal: real, variacao, variacaoPerc, dentro },
      })
    );

    // Cria movimentação de ajuste se houve diferença
    if (variacao !== 0) {
      ajustes.push(
        prisma.movimentacaoEstoque.create({
          data: {
            empresaId:  EMPRESA_ID,
            insumoId:   item.insumoId,
            tipo:       "AJUSTE",
            quantidade: Math.abs(variacao),
            custo:      Math.abs(variacao) * Number(item.insumo.custo),
            origem:     "INVENTARIO",
            observacao: `Inventário ${id} — variação: ${variacao > 0 ? "+" : ""}${variacao.toFixed(3)} ${item.insumo.unidade}`,
          },
        })
      );

      // Atualiza estoque real no insumo
      atualizacoes.push(
        prisma.insumo.update({
          where: { id: item.insumoId },
          data:  { estoqueAtual: Math.max(0, real) },
        })
      );
    }
  }

  // Finaliza o inventário
  ops.push(
    prisma.inventario.update({
      where: { id },
      data:  { status: "FINALIZADO", finalizadoEm: new Date() },
    }) as never
  );

  await prisma.$transaction([...ops, ...ajustes, ...atualizacoes]);

  const finalizado = await prisma.inventario.findUnique({
    where:   { id },
    include: { itens: { include: { insumo: true } } },
  });

  return resposta(finalizado);
}
