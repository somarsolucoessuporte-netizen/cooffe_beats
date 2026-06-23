import { prisma } from "@/lib/prisma";
import CardapioWebClient from "./CardapioClient";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

export const dynamic = "force-dynamic";

export default async function WebCardapioPage() {
  const categorias = await prisma.categoria.findMany({
    where:   { empresaId: EMPRESA_ID, ativo: true },
    orderBy: { ordem: "asc" },
  });

  const primeiraCat = categorias[0] ?? null;

  const produtosIniciais = primeiraCat
    ? await prisma.produto.findMany({
        where:   { empresaId: EMPRESA_ID, categoriaId: primeiraCat.id, disponivel: true },
        orderBy: { ordem: "asc" },
      })
    : [];

  return (
    <CardapioWebClient
      categorias={categorias.map(function (c) {
        return { id: c.id, nome: c.nome, emoji: c.emoji, ordem: c.ordem };
      })}
      produtosIniciais={produtosIniciais.map(function (p) {
        return {
          id:          p.id,
          nome:        p.nome,
          descricao:   p.descricao,
          preco:       Number(p.preco),
          fotoUrl:     p.fotoUrl ?? null,
          destaque:    p.destaque,
          categoriaId: p.categoriaId,
        };
      })}
      categoriaInicialId={primeiraCat?.id ?? ""}
    />
  );
}
