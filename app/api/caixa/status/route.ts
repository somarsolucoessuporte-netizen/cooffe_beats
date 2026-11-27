import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { resumoCaixa } from "@/lib/caixa-fechamento";
import { diaSP, intervaloDias } from "@/lib/fuso";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  // Admin/staff logado usa a empresa da sessão; totem anônimo manda ?empresaId=
  const empresaId = session?.user
    ? (session.user as { empresaId?: string }).empresaId
    : req.nextUrl.searchParams.get("empresaId") ?? undefined;

  if (!empresaId) return erroResposta("Não autenticado", 401);

  const caixa = await prisma.caixa.findFirst({
    where: { empresaId, status: "ABERTO" },
    include: {
      usuario: { select: { nome: true } },
    },
    orderBy: { abridoEm: "desc" },
  });

  if (!caixa) return resposta({ aberto: false, caixa: null });
  const { divisao, ...totais } = await resumoCaixa(empresaId, caixa.id);

  // Abertura pelo painel nunca grava operadorNome; pelo totem, sempre grava
  const origem = caixa.operadorNome ? "TOTEM" : "PAINEL";

  const inicioDoDia = intervaloDias(diaSP()).inicio;

  return resposta({
    aberto:        true,
    abertoHoje:    caixa.abridoEm >= inicioDoDia,
    caixaId:       caixa.id,
    abertura:      caixa.abridoEm,
    valorAbertura: Number(caixa.valorAbertura),
    caixa: {
      id:            caixa.id,
      abridoEm:      caixa.abridoEm,
      valorAbertura: Number(caixa.valorAbertura),
      operador:      caixa.usuario?.nome ?? caixa.operadorNome ?? "—",
      origem,
    },
    resumo: { ...totais, divisao },

  });
}
