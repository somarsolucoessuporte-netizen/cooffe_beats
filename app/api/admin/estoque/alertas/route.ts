import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta } from "@/lib/api-response";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

// GET — insumos abaixo do estoque mínimo (alertas de reposição)
export async function GET() {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE", "BARISTA", "ATENDENTE"]);
  if (erro) return erro;

  const insumos = await prisma.insumo.findMany({
    where: { empresaId: EMPRESA_ID, ativo: true },
  });

  const alertas = insumos
    .filter(function (i) { return Number(i.estoqueAtual) < Number(i.estoqueMinimo); })
    .map(function (i) {
      return {
        id:           i.id,
        nome:         i.nome,
        unidade:      i.unidade,
        estoqueAtual: Number(i.estoqueAtual),
        estoqueMinimo: Number(i.estoqueMinimo),
        deficit:      Number(i.estoqueMinimo) - Number(i.estoqueAtual),
      };
    })
    .sort(function (a, b) { return b.deficit - a.deficit });

  return resposta(alertas);
}
