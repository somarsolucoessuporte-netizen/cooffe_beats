import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getAdminSession } from "@/lib/admin-auth";

const ProdutoSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().default(""),
  preco: z.number().positive(),
  categoriaId: z.string(),
  fotoUrl: z.string().nullable().optional(),
  destaque: z.boolean().default(false),
  disponivel: z.boolean().default(true),
  ordem: z.number().default(0),
});

export async function GET() {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  try {
    const produtos = await prisma.produto.findMany({
      where: { empresaId: empresaId! },
      include: { categoria: true },
      orderBy: [{ categoria: { ordem: "asc" } }, { ordem: "asc" }, { nome: "asc" }],
    });
    return resposta(produtos);
  } catch {
    return erroResposta("Erro ao buscar produtos", 500);
  }
}

export async function POST(req: NextRequest) {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  try {
    const body = await req.json();
    const validacao = ProdutoSchema.safeParse(body);
    if (!validacao.success) return erroResposta(validacao.error.message);

    const { fotoUrl, ...rest } = validacao.data;
    const produto = await prisma.produto.create({
      data: { ...rest, fotoUrl: fotoUrl ?? null, empresaId: empresaId! },
      include: { categoria: true },
    });
    return resposta(produto, 201);
  } catch {
    return erroResposta("Erro ao criar produto", 500);
  }
}
