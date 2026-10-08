import { prisma } from "@/lib/prisma";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

// Carrega categorias + produtos da primeira categoria (com adicionais ativos)
// Usado por /web/cardapio (portal com login) e /web/m (cardápio da mesa)
export async function carregarCardapioWeb() {
  const categorias = await prisma.categoria.findMany({
    where:   { empresaId: EMPRESA_ID, ativo: true },
    orderBy: { ordem: "asc" },
  });

  const primeiraCat = categorias[0] ?? null;

  const produtos = primeiraCat
    ? await prisma.produto.findMany({
        where:   { empresaId: EMPRESA_ID, categoriaId: primeiraCat.id, disponivel: true },
        orderBy: { ordem: "asc" },
        include: { adicionais: { include: { adicional: true } } },
      })
    : [];

  return {
    categorias: categorias.map(function (c) {
      return { id: c.id, nome: c.nome, emoji: c.emoji, ordem: c.ordem };
    }),
    produtosIniciais: produtos.map(function (p) {
      return {
        id:          p.id,
        nome:        p.nome,
        descricao:   p.descricao,
        preco:       Number(p.preco),
        fotoUrl:     p.fotoUrl ?? null,
        destaque:    p.destaque,
        categoriaId: p.categoriaId,
        adicionais:  p.adicionais
          .filter(function (pa) { return pa.adicional.ativo; })
          .map(function (pa) {
            return { id: pa.adicional.id, nome: pa.adicional.nome, preco: Number(pa.adicional.preco) };
          }),
      };
    }),
    categoriaInicialId: primeiraCat?.id ?? "",
  };
}
