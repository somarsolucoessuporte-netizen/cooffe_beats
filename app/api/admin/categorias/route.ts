import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getAdminSession } from "@/lib/admin-auth";

const CategoriaSchema = z.object({
  nome: z.string().min(1),
  emoji: z.string().default("🍽️"),
  ordem: z.number().default(0),
  ativo: z.boolean().default(true),
});

export async function GET() {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  try {
    const categorias = await prisma.categoria.findMany({
      where: { empresaId: empresaId! },
      include: { _count: { select: { produtos: true } } },
      orderBy: { ordem: "asc" },
    });
    return resposta(categorias);
  } catch {
    return erroResposta("Erro ao buscar categorias", 500);
  }
}

export async function POST(req: NextRequest) {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  try {
    const body = await req.json();
    const validacao = CategoriaSchema.safeParse(body);
    if (!validacao.success) return erroResposta(validacao.error.message);

    const categoria = await prisma.categoria.create({
      data: { ...validacao.data, empresaId: empresaId! },
    });
    return resposta(categoria, 201);
  } catch {
    return erroResposta("Erro ao criar categoria", 500);
  }
}
