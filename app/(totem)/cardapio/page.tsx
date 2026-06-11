"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import HeaderTotem from "@/components/totem/HeaderTotem";
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
  preco: string;
  fotoUrl: string | null;
  destaque: boolean;
  categoriaId: string;
}

export default function Cardapio() {
  const router = useRouter();
  const empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("");
  const [carregando, setCarregando] = useState(true);

  // Busca categorias ao montar
  useEffect(() => {
    if (!empresaId) return;
    fetch(`/api/categorias?empresaId=${empresaId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok && res.data.length > 0) {
          setCategorias(res.data);
          setCategoriaAtiva(res.data[0].id);
        }
      });
  }, [empresaId]);

  // Busca produtos quando categoria muda
  useEffect(() => {
    if (!categoriaAtiva || !empresaId) return;
    setCarregando(true);
    fetch(`/api/produtos?empresaId=${empresaId}&categoriaId=${categoriaAtiva}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setProdutos(res.data);
      })
      .finally(() => setCarregando(false));
  }, [categoriaAtiva, empresaId]);

  const irParaProduto = useCallback(
    (id: string) => router.push(`/produto/${id}`),
    [router]
  );

  return (
    <div className="h-full flex flex-col">
      <HeaderTotem />

      {/* Chips de categorias */}
      <div className="flex gap-3 px-6 py-4 overflow-x-auto totem-scroll border-b border-cb-caramel/20 shrink-0">
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoriaAtiva(cat.id)}
            className={`
              flex items-center gap-2 px-5 py-3 rounded-full whitespace-nowrap
              font-sans font-semibold text-base touch-manipulation
              transition-all active:scale-95 min-h-[56px]
              ${
                categoriaAtiva === cat.id
                  ? "bg-cb-amber text-cb-espresso"
                  : "bg-cb-mocha text-cb-cream border border-cb-caramel/30"
              }
            `}
          >
            <span>{cat.emoji}</span>
            <span>{cat.nome}</span>
          </button>
        ))}
      </div>

      {/* Grid de produtos */}
      <div className="flex-1 overflow-y-auto totem-scroll p-6">
        {carregando ? (
          <div className="grid grid-cols-2 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-cb-mocha rounded-2xl h-72 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            {produtos.map((produto) => (
              <button
                key={produto.id}
                onClick={() => irParaProduto(produto.id)}
                className="bg-cb-mocha border border-cb-caramel/30 rounded-2xl overflow-hidden
                           text-left touch-manipulation active:scale-95 transition-transform
                           flex flex-col"
              >
                {/* Foto */}
                <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-cb-mocha to-cb-caramel">
                  {produto.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={produto.fotoUrl}
                      alt={produto.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-5xl opacity-30">☕</span>
                    </div>
                  )}
                  {produto.destaque && (
                    <span className="absolute top-2 left-2 bg-cb-amber text-cb-espresso font-bold text-xs px-3 py-1 rounded-full">
                      DESTAQUE
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-4 flex flex-col gap-1">
                  <p className="font-display text-lg text-cb-cream font-semibold leading-snug">
                    {produto.nome}
                  </p>
                  <p className="font-sans text-sm text-cb-latte line-clamp-2">
                    {produto.descricao}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className="font-display text-xl text-cb-gold font-bold">
                      {formatarMoeda(produto.preco)}
                    </span>
                    <span className="bg-cb-amber text-cb-espresso rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl">
                      +
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
