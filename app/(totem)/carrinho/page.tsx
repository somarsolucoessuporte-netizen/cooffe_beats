"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { playClick } from "@/lib/sounds";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import HeaderTotem from "@/components/totem/HeaderTotem";
import { formatarMoeda } from "@/lib/utils";

export default function Carrinho() {
  const router = useRouter();
  const { itens, totalValor, removerItem, alterarQuantidade } = useCarrinho();
  const [confirmandoRemocao, setConfirmandoRemocao] = useState<number | null>(null);

  const temCafe = itens.some((i) =>
    i.nome.toLowerCase().includes("café") || i.nome.toLowerCase().includes("espresso") ||
    i.nome.toLowerCase().includes("cappuccino") || i.nome.toLowerCase().includes("latte")
  );
  const temBolo = itens.some((i) =>
    i.nome.toLowerCase().includes("bolo") || i.nome.toLowerCase().includes("torta")
  );
  const sugerirCombo = temCafe && !temBolo;

  if (itens.length === 0) {
    return (
      <div className="h-full flex flex-col animate-fadeIn">
        <HeaderTotem />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <span className="text-8xl">🛒</span>
          <p className="font-sans font-extrabold text-2xl text-cb-marrom">Seu carrinho está vazio</p>
          <p className="text-cb-marrom/60 text-lg">Adicione produtos para continuar</p>
          <button
            onClick={() => { playClick(); router.push("/cardapio"); }}
            className="bg-cb-marrom text-cb-bege font-extrabold text-lg px-10 py-5 rounded-full
                       touch-manipulation btn-totem min-h-[72px]"
          >
            Ver Cardápio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <HeaderTotem />

      <div className="flex-1 overflow-y-auto totem-scroll p-6 flex flex-col gap-4">
        {itens.map((item, index) => (
          <div
            key={`${item.produtoId}-${index}`}
            className="bg-white border border-cb-marrom/10 rounded-2xl p-4 flex gap-4 shadow-sm"
          >
            {/* Foto mini */}
            <div className="w-20 h-20 rounded-xl bg-cb-bege flex items-center justify-center shrink-0 overflow-hidden">
              {item.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.fotoUrl} alt={item.nome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl opacity-20">☕</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-sans font-extrabold text-lg text-cb-marrom leading-snug truncate">
                {item.nome}
              </p>
              {item.adicionais.length > 0 && (
                <p className="text-xs text-cb-marrom/50 mt-1">
                  + {item.adicionais.map((a) => a.nome).join(", ")}
                </p>
              )}
              <p className="font-extrabold text-cb-amber mt-1">
                {formatarMoeda((item.preco + item.adicionais.reduce((s, a) => s + a.preco, 0)) * item.quantidade)}
              </p>
            </div>

            {/* Controles */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { playClick(); alterarQuantidade(index, item.quantidade - 1); }}
                  className="w-10 h-10 rounded-full bg-cb-marrom/10 text-cb-marrom font-bold text-lg
                             touch-manipulation btn-totem"
                >
                  −
                </button>
                <span className="font-sans font-extrabold text-xl text-cb-marrom w-6 text-center">
                  {item.quantidade}
                </span>
                <button
                  onClick={() => { playClick(); alterarQuantidade(index, item.quantidade + 1); }}
                  className="w-10 h-10 rounded-full bg-cb-amber text-cb-bege font-bold text-lg
                             touch-manipulation btn-totem"
                >
                  +
                </button>
              </div>

              {confirmandoRemocao === index ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { removerItem(index); setConfirmandoRemocao(null); }}
                    className="text-xs bg-red-600 text-white px-3 py-1 rounded-full touch-manipulation"
                  >
                    Remover
                  </button>
                  <button
                    onClick={() => setConfirmandoRemocao(null)}
                    className="text-xs bg-cb-bege border border-cb-marrom/20 text-cb-marrom px-3 py-1 rounded-full touch-manipulation"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmandoRemocao(index)}
                  className="text-cb-marrom/30 text-sm touch-manipulation p-1"
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}

        {sugerirCombo && (
          <button
            onClick={() => router.push("/cardapio")}
            className="bg-cb-amber/10 border border-cb-amber rounded-2xl p-4 text-left
                       touch-manipulation active:scale-[0.99] transition-transform"
          >
            <p className="font-sans font-extrabold text-cb-marrom text-base">🍰 Complete seu pedido!</p>
            <p className="text-cb-marrom/70 text-sm mt-1">
              Adicione um bolo ou sobremesa e monte um combo especial.
            </p>
          </button>
        )}

        <div className="h-4" />
      </div>

      {/* Rodapé */}
      <div className="shrink-0 bg-white border-t border-cb-marrom/10 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-cb-marrom/70 text-lg">Total</span>
          <span className="font-sans font-extrabold text-3xl text-cb-marrom">
            {formatarMoeda(totalValor)}
          </span>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => { playClick(); router.push("/cardapio"); }}
            className="flex-1 border-2 border-cb-marrom text-cb-marrom font-extrabold font-sans text-lg
                       py-4 rounded-full touch-manipulation btn-totem min-h-[64px]"
          >
            + Itens
          </button>
          <button
            onClick={() => { playClick(); router.push("/pagamento"); }}
            className="flex-[2] bg-cb-marrom text-cb-bege font-extrabold font-sans text-lg
                       py-4 rounded-full touch-manipulation btn-totem min-h-[64px]"
          >
            Ir para Pagamento
          </button>
        </div>
      </div>
    </div>
  );
}
