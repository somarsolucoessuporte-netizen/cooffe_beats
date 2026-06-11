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
      <div className="flex gap-3 px-6 py-4 overflow-x-auto totem-scroll border-b border-amber-900/30 shrink-0">
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
      <div className="flex-1 overflow-y-auto totem-scroll px-6 py-5">
        {carregando ? (
          <div className="grid grid-cols-2 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#1e0f02] rounded-3xl h-72 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {produtos.map((produto) => (
              <button
                key={produto.id}
                onClick={() => irParaProduto(produto.id)}
                className="bg-[#1e0f02] border border-[#3D1F00] rounded-3xl overflow-hidden
                           text-left touch-manipulation active:scale-95 transition-all
                           hover:shadow-lg hover:shadow-amber-900/50 flex flex-col"
              >
                {/* Foto — aspect 16/9 */}
                <div className="relative w-full aspect-video bg-gradient-to-br from-[#2a1200] to-[#3D1F00]">
                  {produto.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={produto.fotoUrl}
                      alt={produto.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-5xl opacity-20">☕</span>
                    </div>
                  )}
                  {produto.destaque && (
                    <span className="absolute top-2 left-2 bg-amber-500 text-stone-900 font-bold text-xs px-3 py-1 rounded-full">
                      DESTAQUE
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-4 flex flex-col gap-1">
                  <p className="text-xl font-bold text-amber-200 leading-snug">
                    {produto.nome}
                  </p>
                  <p className="text-sm text-amber-100/70 line-clamp-2">
                    {produto.descricao}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-3">
                    <span className="text-2xl font-bold text-amber-400">
                      {formatarMoeda(produto.preco)}
                    </span>
                    <span className="bg-amber-500 text-stone-900 rounded-full w-14 h-14 flex items-center justify-center font-bold text-2xl shrink-0">
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
