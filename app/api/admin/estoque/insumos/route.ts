import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

// GET — lista todos os insumos com indicadores de alerta
export async function GET() {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const insumos = await prisma.insumo.findMany({
    where:   { empresaId: EMPRESA_ID, ativo: true },
    orderBy: { nome: "asc" },
  });

  const resultado = insumos.map(function (i) {
    var atual  = Number(i.estoqueAtual);
    var minimo = Number(i.estoqueMinimo);
    return {
      ...i,
      estoqueAtual:    atual,
      estoqueMinimo:   minimo,
      percentualPerda: Number(i.percentualPerda),
      custo:           Number(i.custo),
      // Indicadores visuais: crítico = abaixo do mínimo, atenção = até 20% acima do mínimo
      critico:  atual < minimo,
      atencao:  atual >= minimo && atual < minimo * 1.2,
    };
  });

  return resposta(resultado);
}

// POST — cria novo insumo
export async function POST(req: NextRequest) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const body = await req.json() as {
    nome: string; unidade: string;
    estoqueAtual?: number; estoqueMinimo?: number;
    percentualPerda?: number; custo?: number;
  };

  if (!body.nome?.trim() || !body.unidade?.trim()) {
    return erroResposta("nome e unidade são obrigatórios");
  }

  const insumo = await prisma.insumo.create({
    data: {
      empresaId:       EMPRESA_ID,
      nome:            body.nome.trim(),
      unidade:         body.unidade.trim(),
      estoqueAtual:    body.estoqueAtual    ?? 0,
      estoqueMinimo:   body.estoqueMinimo   ?? 0,
      percentualPerda: body.percentualPerda ?? 3,
      custo:           body.custo           ?? 0,
    },
  });

  return resposta(insumo, 201);
}
