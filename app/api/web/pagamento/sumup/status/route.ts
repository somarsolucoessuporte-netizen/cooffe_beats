import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const sessaoId = req.nextUrl.searchParams.get("sessao");
  if (!sessaoId) return erroResposta("Parâmetro sessao obrigatório");

  const sessao = await prisma.checkoutSessao.findUnique({
    where:  { id: sessaoId },
    select: { status: true, pedidoId: true, expiresAt: true },
  });

  if (!sessao) return erroResposta("Sessão não encontrada", 404);

  return resposta({
    status:   sessao.status,
    pedidoId: sessao.pedidoId,
    expirado: sessao.expiresAt < new Date(),
  });
}
