"use client";

import { useState, useCallback } from "react";
import { useWebCarrinho } from "@/contexts/WebCarrinhoContext";
import { formatarMoeda } from "@/lib/utils";

interface Categoria {
  id: string;
  nome: string;
  emoji: string;
  ordem: number;
}

interface Produto {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  fotoUrl: string | null;
  destaque: boolean;
  categoriaId: string;
}

interface Props {
  categorias:        Categoria[];
  produtosIniciais:  Produto[];
  categoriaInicialId: string;
}

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

export default function CardapioWebClient({ categorias, produtosIniciais, categoriaInicialId }: Props) {
  const { adicionarItem, totalItens } = useWebCarrinho();

  const [categoriaAtiva,  setCategoriaAtiva]  = useState(categoriaInicialId);
  const [produtos,        setProdutos]         = useState<Produto[]>(produtosIniciais);
  const [carregando,      setCarregando]       = useState(false);
  const [adicionado,      setAdicionado]       = useState<string | null>(null); // produtoId do toast

  const trocarCategoria = useCallback(async function (catId: string) {
    if (catId === categoriaAtiva) return;
    setCategoriaAtiva(catId);
    setCarregando(true);
    try {
      var r = await fetch(`/api/produtos?empresaId=${EMPRESA_ID}&categoriaId=${catId}`);
      var d = await r.json();
      if (d.ok) {
        setProdutos(d.data.map(function (p: { id: string; nome: string; descricao: string; preco: string; fotoUrl: string | null; destaque: boolean; categoriaId: string }) {
          return { ...p, preco: Number(p.preco) };
        }));
      }
    } catch {}
    finally { setCarregando(false); }
  }, [categoriaAtiva]);

  function adicionar(produto: Produto) {
    adicionarItem({
      produtoId: produto.id,
      nome:      produto.nome,
      preco:     produto.preco,
      quantidade: 1,
      fotoUrl:   produto.fotoUrl,
    });
    setAdicionado(produto.id);
    setTimeout(function () { setAdicionado(null); }, 1500);
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">

      {/* Banner de boas-vindas */}
      <div className="mb-8 rounded-3xl overflow-hidden bg-cb-marrom px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-cb-bege leading-tight">
            Cardápio ☕
          </h1>
          <p className="text-cb-bege/60 text-sm mt-1">
            Escolha seus favoritos e acompanhe o preparo em tempo real
          </p>
        </div>
        {totalItens > 0 && (
          <a
            href="/web/carrinho"
            className="bg-cb-amber text-white font-extrabold text-sm px-5 py-3 rounded-2xl
                       hover:bg-cb-amber/90 transition-colors whitespace-nowrap shrink-0 ml-4"
          >
            Ver carrinho ({totalItens})
          </a>
        )}
      </div>

      <div className="flex gap-8">

        {/* Sidebar de categorias — desktop */}
        <aside className="hidden md:flex flex-col gap-1 w-52 shrink-0">
          <p className="text-xs font-bold text-cb-marrom/40 uppercase tracking-widest px-3 mb-2">
            Categorias
          </p>
          {categorias.map(function (cat) {
            var ativo = cat.id === categoriaAtiva;
            return (
              <button
                key={cat.id}
                onClick={function () { trocarCategoria(cat.id); }}
                className={
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-colors " +
                  (ativo
                    ? "bg-cb-marrom text-cb-bege"
                    : "text-cb-marrom/70 hover:bg-cb-bege hover:text-cb-marrom")
                }
              >
                <span className="text-lg">{cat.emoji}</span>
                <span>{cat.nome}</span>
              </button>
            );
          })}
        </aside>

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">

          {/* Tabs de categoria — mobile */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 md:hidden">
            {categorias.map(function (cat) {
              var ativo = cat.id === categoriaAtiva;
              return (
                <button
                  key={cat.id}
                  onClick={function () { trocarCategoria(cat.id); }}
                  className={
                    "flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold shrink-0 transition-colors " +
                    (ativo
                      ? "bg-cb-marrom text-cb-bege"
                      : "border border-cb-marrom/20 text-cb-marrom/70")
                  }
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.nome}</span>
                </button>
              );
            })}
          </div>

          {/* Grid de produtos */}
          {carregando ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map(function (_, i) {
                return <div key={i} className="bg-cb-marrom/8 rounded-2xl h-64 animate-pulse" />;
              })}
            </div>
          ) : produtos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-cb-marrom/30">
              <span className="text-5xl">☕</span>
              <p className="text-sm font-medium">Nenhum produto disponível nesta categoria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {produtos.map(function (produto) {
                var foiAdicionado = adicionado === produto.id;
                return (
                  <div
                    key={produto.id}
                    className="bg-white border border-cb-marrom/10 rounded-2xl overflow-hidden
                               shadow-sm hover:shadow-md transition-shadow flex flex-col group"
                  >
                    {/* Foto */}
                    <div className="relative w-full aspect-[4/3] bg-cb-bege overflow-hidden">
                      {produto.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={produto.fotoUrl}
                          alt={produto.nome}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-5xl opacity-20">☕</span>
                        </div>
                      )}
                      {produto.destaque && (
                        <span className="absolute top-2 left-2 bg-cb-amber text-white text-xs
                                         font-bold px-2 py-0.5 rounded-full">
                          Destaque
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <p className="font-bold text-cb-marrom text-sm leading-snug line-clamp-1">
                        {produto.nome}
                      </p>
                      <p className="text-cb-marrom/50 text-xs line-clamp-2 flex-1">
                        {produto.descricao}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-extrabold text-cb-amber text-base">
                          {formatarMoeda(produto.preco)}
                        </span>
                        <button
                          onClick={function () { adicionar(produto); }}
                          className={
                            "flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition-colors " +
                            (foiAdicionado
                              ? "bg-green-500 text-white"
                              : "bg-cb-marrom text-cb-bege hover:bg-cb-amber")
                          }
                        >
                          {foiAdicionado ? (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M20 6L9 17l-5-5"/>
                              </svg>
                              OK
                            </>
                          ) : (
                            <>
                              <span className="text-base leading-none">+</span>
                              Adicionar
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
