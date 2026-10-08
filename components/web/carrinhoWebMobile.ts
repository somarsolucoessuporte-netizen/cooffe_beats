"use client";

import { useWebCarrinho } from "@/contexts/WebCarrinhoContext";
import type { CarrinhoMobile } from "@/components/web/MobileCardapio";

// Adaptador do carrinho do portal web para o MobileCardapio
// (no carrinho web o preço do item já soma os adicionais)
export function useCarrinhoWebMobile(): CarrinhoMobile {
  const { adicionarItem, totalItens, totalValor } = useWebCarrinho();
  return {
    totalItens,
    totalValor,
    adicionar: function (produto, adicionais, quantidade) {
      const extra = adicionais.reduce(function (s, a) { return s + a.preco; }, 0);
      adicionarItem({
        produtoId:  produto.id,
        nome:       produto.nome,
        preco:      produto.preco + extra,
        quantidade,
        fotoUrl:    produto.fotoUrl,
        adicionais: adicionais.length
          ? adicionais.map(function (a) { return { adicionalId: a.id, nome: a.nome, preco: a.preco }; })
          : undefined,
      });
    },
  };
}
