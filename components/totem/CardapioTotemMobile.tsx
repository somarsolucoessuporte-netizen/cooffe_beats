"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileSplash from "@/components/web/MobileSplash";
import MobileCardapio, { type CarrinhoMobile, type CategoriaMobile } from "@/components/web/MobileCardapio";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import { playClick } from "@/lib/sounds";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

// Mesmo filtro do cardápio do totem (categoria "Adicionais" não aparece)
const CATEGORIAS_OCULTAS_TOTEM = ["Adicionais"];

// Cardápio do totem no celular: splash → grade de categorias → produtos.
// Produtos com adicionais abrem /produto/[id] (bottom sheet no celular).
export default function CardapioTotemMobile() {
  const router = useRouter();
  const { adicionarItem, totalItens, totalValor } = useCarrinho();

  const [categorias, setCategorias] = useState<CategoriaMobile[]>([]);
  const [nome,       setNome]       = useState("");

  useEffect(function () {
    try { setNome(sessionStorage.getItem("clienteNome") ?? ""); } catch {}
    fetch(`/api/categorias?empresaId=${EMPRESA_ID}`)
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.ok) {
          setCategorias((res.data as CategoriaMobile[]).filter(function (c) {
            return !CATEGORIAS_OCULTAS_TOTEM.includes(c.nome);
          }));
        }
      })
      .catch(function () {});
  }, []);

  // Adaptador do carrinho do totem (preço base + adicionais separados)
  const carrinho: CarrinhoMobile = {
    totalItens,
    totalValor,
    adicionar: function (produto, adicionais, quantidade, observacao) {
      playClick();
      adicionarItem({
        produtoId:  produto.id,
        nome:       produto.nome,
        preco:      produto.preco,
        quantidade,
        observacao,
        fotoUrl:    produto.fotoUrl,
        adicionais: adicionais.map(function (a) { return { adicionalId: a.id, nome: a.nome, preco: a.preco }; }),
      });
    },
  };

  return (
    <>
      <MobileSplash sempre />
      <MobileCardapio
        carrinho={carrinho}
        onAbrirProduto={function (p) { playClick(); router.push("/produto/" + p.id); }}
        categorias={categorias}
        produtosIniciais={[]}
        categoriaInicialId=""
        nomeCliente={nome}
        carrinhoHref="/carrinho"
        semNavInferior
      />
    </>
  );
}
