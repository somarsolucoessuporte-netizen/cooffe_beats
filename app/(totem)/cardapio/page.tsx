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
      <div className="flex gap-2 px-4 py-3 overflow-x-auto totem-scroll border-b border-amber-900/30 shrink-0">
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoriaAtiva(cat.id)}
            className={`
              flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap
              font-sans font-semibold text-sm touch-manipulation
              transition-all active:scale-95
              ${
                categoriaAtiva === cat.id
                  ? "bg-amber-500 text-stone-900"
                  : "bg-[#2a1200] text-amber-100/80 border border-amber-900/40"
              }
            `}
          >
            <span>{cat.emoji}</span>
            <span>{cat.nome}</span>
          </button>
        ))}
      </div>

      {/* Grid de produtos */}
      <div className="flex-1 overflow-y-auto totem-scroll px-4 py-4">
        {carregando ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#1e0f02] rounded-2xl h-52 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {produtos.map((produto) => (
              <button
                key={produto.id}
                onClick={() => irParaProduto(produto.id)}
                className="bg-[#1e0f02] border border-[#3D1F00] rounded-2xl overflow-hidden
                           text-left touch-manipulation active:scale-95 transition-all
                           hover:shadow-lg hover:shadow-amber-900/40 flex flex-col"
              >
                {/* Foto — aspect 4/3 com botão "+" sobreposto */}
                <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-[#2a1200] to-[#3D1F00]">
                  {produto.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={produto.fotoUrl}
                      alt={produto.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl opacity-20">☕</span>
                    </div>
                  )}

                  {produto.destaque && (
                    <span className="absolute top-2 left-2 bg-amber-500 text-stone-900 font-bold text-xs px-2 py-0.5 rounded-full">
                      DESTAQUE
                    </span>
                  )}

                  {/* Botão "+" sobre a foto */}
                  <span className="absolute bottom-2 right-2 bg-amber-500 text-stone-900
                                   rounded-full w-10 h-10 flex items-center justify-center
                                   font-bold text-lg shadow-md shadow-black/40">
                    +
                  </span>
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col gap-1">
                  <p className="text-base font-semibold text-amber-200 leading-snug">
                    {produto.nome}
                  </p>
                  <p className="text-xs text-amber-100/60 line-clamp-2">
                    {produto.descricao}
                  </p>
                  <p className="text-lg font-bold text-amber-400 mt-1">
                    {formatarMoeda(produto.preco)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
