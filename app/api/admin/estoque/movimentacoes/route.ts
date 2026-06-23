import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

// GET — histórico de movimentações com filtros opcionais
export async function GET(req: NextRequest) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const p = req.nextUrl.searchParams;
  const insumoId   = p.get("insumoId")   ?? undefined;
  const tipo       = p.get("tipo")        ?? undefined;
  const origem     = p.get("origem")      ?? undefined;
  const dataInicio = p.get("dataInicio")  ?? undefined;
  const dataFim    = p.get("dataFim")     ?? undefined;
  const limite     = Number(p.get("limite") ?? 50);

  const movimentacoes = await prisma.movimentacaoEstoque.findMany({
    where: {
      empresaId: EMPRESA_ID,
      ...(insumoId   ? { insumoId }                     : {}),
      ...(tipo       ? { tipo }                          : {}),
      ...(origem     ? { origem }                        : {}),
      ...(dataInicio || dataFim ? {
        createdAt: {
          ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
          ...(dataFim    ? { lte: new Date(dataFim)    } : {}),
        },
      } : {}),
    },
    include: { insumo: { select: { nome: true, unidade: true } } },
    orderBy: { createdAt: "desc" },
    take:    Math.min(limite, 500),
  });

  return resposta(movimentacoes);
}

// POST — registra movimentação manual e atualiza estoqueAtual
export async function POST(req: NextRequest) {
  const { erro, perfil } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const body = await req.json() as {
    insumoId: string; tipo: string; quantidade: number;
    custo?: number; origem?: string; observacao?: string;
  };

  if (!body.insumoId || !body.tipo || body.quantidade == null) {
    return erroResposta("insumoId, tipo e quantidade são obrigatórios");
  }

  const tipos   = ["ENTRADA", "SAIDA", "AJUSTE", "PERDA"];
  const origens = ["COMPRA", "VENDA", "INVENTARIO", "MANUAL", "NFE"];

  if (!tipos.includes(body.tipo)) return erroResposta("tipo inválido");

  const origem = body.origem ?? "MANUAL";
  if (!origens.includes(origem)) return erroResposta("origem inválida");

  // Calcula novo estoque conforme tipo
  const insumo = await prisma.insumo.findUnique({ where: { id: body.insumoId } });
  if (!insumo) return erroResposta("Insumo não encontrado", 404);

  var atual    = Number(insumo.estoqueAtual);
  var novoEstoque: number;
  switch (body.tipo) {
    case "ENTRADA":
      novoEstoque = atual + body.quantidade;
      break;
    case "AJUSTE":
      // Ajuste define o valor absoluto
      novoEstoque = body.quantidade;
      break;
    default: // SAIDA | PERDA — estoque nunca vai negativo, apenas alerta
      novoEstoque = Math.max(0, atual - body.quantidade);
  }

  var custoTotal = body.custo != null
    ? body.custo
    : Number(insumo.custo) * body.quantidade;

  const [movimentacao] = await prisma.$transaction([
    prisma.movimentacaoEstoque.create({
      data: {
        empresaId:  EMPRESA_ID,
        insumoId:   body.insumoId,
        tipo:       body.tipo,
        quantidade: body.quantidade,
        custo:      custoTotal,
        origem,
        observacao: body.observacao ?? null,
        criadoPor:  perfil ?? null,
      },
    }),
    prisma.insumo.update({
      where: { id: body.insumoId },
      data:  { estoqueAtual: novoEstoque },
    }),
  ]);

  return resposta(movimentacao, 201);
}
