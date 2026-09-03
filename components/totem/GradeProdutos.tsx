"use client";

import { useRouter } from "next/navigation";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import { formatarMoeda } from "@/lib/utils";
import { playClick } from "@/lib/sounds";

interface Produto {
  id: string;
  nome: string;
  descricao: string;
  preco: string;
  fotoUrl: string | null;
  destaque: boolean;
  categoriaId: string;
}

interface GradeProdutosProps {
  produtos: Produto[];
  carregando: boolean;
}

export default function GradeProdutos({ produtos, carregando }: GradeProdutosProps) {
  const router = useRouter();
  const { adicionarItem } = useCarrinho();

  return (
    <div className="flex-1 overflow-y-auto totem-scroll p-3 bg-cb-bege">
      {carregando ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[10px]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-cb-marrom/10 rounded-[10px] h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[10px]">
          {produtos.map((produto) => (
            <div
              key={produto.id}
              onClick={() => { playClick(); router.push(`/produto/${produto.id}`); }}
              className="relative bg-white border-[0.5px] border-black/[0.08] rounded-[10px]
                         overflow-hidden touch-manipulation active:scale-95 btn-totem
                         flex flex-col cursor-pointer"
            >
              {/* Imagem */}
              <div className="relative w-full h-40 bg-cb-bege overflow-hidden shrink-0">
                {produto.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={produto.fotoUrl}
                    alt={produto.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl opacity-20">☕</span>
                  </div>
                )}

                {produto.destaque && (
                  <span className="absolute top-1 left-1 bg-cb-gold text-cb-marrom
                                   font-bold text-[8px] px-1.5 py-0.5 rounded-full">
                    DESTAQUE
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-2 flex flex-col gap-0.5 flex-1">
                <p className="text-[9.5px] font-medium text-cb-marrom leading-snug line-clamp-1">
                  {produto.nome}
                </p>
                {produto.descricao && (
                  <p className="text-[8px] text-cb-marrom/60 line-clamp-2 leading-snug">
                    {produto.descricao}
                  </p>
                )}
                <div className="mt-auto pt-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cb-amber">
                    {formatarMoeda(produto.preco)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playClick();
                      adicionarItem({
                        produtoId: produto.id,
                        nome: produto.nome,
                        preco: parseFloat(produto.preco),
                        quantidade: 1,
                        adicionais: [],
                        fotoUrl: produto.fotoUrl,
                      });
                    }}
                    className="w-5 h-5 rounded-full bg-cb-marrom text-white
                               flex items-center justify-center text-xs font-bold shrink-0
                               touch-manipulation btn-totem active:scale-90"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
