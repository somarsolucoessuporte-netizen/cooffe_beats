import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const categoriaId = req.nextUrl.searchParams.get("categoriaId");
  const empresaId = req.nextUrl.searchParams.get("empresaId");

  if (!empresaId) {
    return erroResposta("empresaId é obrigatório");
  }

  try {
    const produtos = await prisma.produto.findMany({
      where: {
        empresaId,
        disponivel: true,
        ...(categoriaId ? { categoriaId } : {}),
      },
      include: {
        categoria: true,
        adicionais: {
          include: { adicional: true },
        },
      },
      orderBy: [{ destaque: "desc" }, { ordem: "asc" }],
    });

    return resposta(produtos);
  } catch {
    return erroResposta("Erro ao buscar produtos", 500);
  }
}
