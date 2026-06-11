import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresaId");

  if (!empresaId) {
    return erroResposta("empresaId é obrigatório");
  }

  try {
    const categorias = await prisma.categoria.findMany({
      where: { empresaId, ativo: true },
      orderBy: { ordem: "asc" },
    });

    return resposta(categorias);
  } catch {
    return erroResposta("Erro ao buscar categorias", 500);
  }
}
