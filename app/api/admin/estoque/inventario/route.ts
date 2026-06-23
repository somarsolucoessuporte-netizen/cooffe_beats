import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

// GET — lista inventários anteriores
export async function GET() {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const inventarios = await prisma.inventario.findMany({
    where:   { empresaId: EMPRESA_ID },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { itens: true } } },
  });

  return resposta(inventarios);
}

// POST — inicia novo inventário com snapshot do estoque atual
export async function POST(req: NextRequest) {
  const { erro, perfil } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  // Verifica se não há inventário aberto
  const aberto = await prisma.inventario.findFirst({
    where: { empresaId: EMPRESA_ID, status: "ABERTO" },
  });
  if (aberto) {
    return erroResposta("Já existe um inventário aberto. Finalize-o antes de iniciar outro.");
  }

  const body = await req.json().catch(function () { return {}; }) as { observacao?: string };

  // Snapshot do estoque atual de todos os insumos ativos
  const insumos = await prisma.insumo.findMany({
    where: { empresaId: EMPRESA_ID, ativo: true },
  });

  const inventario = await prisma.inventario.create({
    data: {
      empresaId:  EMPRESA_ID,
      status:     "ABERTO",
      observacao: body.observacao ?? null,
      criadoPor:  perfil ?? null,
      itens: {
        create: insumos.map(function (i) {
          return {
            insumoId:       i.id,
            estoqueTeorico: i.estoqueAtual, // teorico = estoque no momento do inventário
            estoqueReal:    0,
            variacao:       0,
            variacaoPerc:   0,
            dentro:         true,
          };
        }),
      },
    },
    include: {
      itens: { include: { insumo: true } },
    },
  });

  return resposta(inventario, 201);
}
