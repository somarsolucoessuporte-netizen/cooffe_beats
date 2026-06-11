"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import HeaderTotem from "@/components/totem/HeaderTotem";
import { formatarMoeda } from "@/lib/utils";

export default function Carrinho() {
  const router = useRouter();
  const { itens, totalValor, removerItem, alterarQuantidade } = useCarrinho();
  const [confirmandoRemocao, setConfirmandoRemocao] = useState<number | null>(null);

  // Detecta combos inteligentes
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
      <div className="h-full flex flex-col">
        <HeaderTotem />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <span className="text-8xl">🛒</span>
          <p className="font-display text-2xl text-cb-cream">Seu carrinho está vazio</p>
          <p className="font-sans text-cb-latte text-lg">Adicione produtos para continuar</p>
          <button
            onClick={() => router.push("/cardapio")}
            className="bg-cb-amber text-cb-espresso font-bold text-lg px-10 py-5 rounded-full
                       touch-manipulation active:scale-95 transition-transform min-h-[72px]"
          >
            Ver Cardápio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <HeaderTotem />

      <div className="flex-1 overflow-y-auto totem-scroll p-6 flex flex-col gap-4">
        {/* Lista de itens */}
        {itens.map((item, index) => (
          <div
            key={`${item.produtoId}-${index}`}
            className="bg-cb-mocha border border-cb-caramel/30 rounded-2xl p-4 flex gap-4"
          >
            {/* Foto mini */}
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-cb-dark to-cb-caramel flex items-center justify-center shrink-0 overflow-hidden">
              {item.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.fotoUrl} alt={item.nome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl opacity-40">☕</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-display text-lg text-cb-cream font-semibold truncate">{item.nome}</p>
              {item.adicionais.length > 0 && (
                <p className="font-sans text-xs text-cb-latte mt-1">
                  + {item.adicionais.map((a) => a.nome).join(", ")}
                </p>
              )}
              <p className="font-display text-cb-gold font-bold mt-1">
                {formatarMoeda((item.preco + item.adicionais.reduce((s, a) => s + a.preco, 0)) * item.quantidade)}
              </p>
            </div>

            {/* Controles */}
            <div className="flex flex-col items-end gap-2">
              {/* Quantidade */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => alterarQuantidade(index, item.quantidade - 1)}
                  className="w-10 h-10 rounded-full bg-cb-espresso text-cb-cream font-bold text-lg
                             touch-manipulation active:scale-90 transition-transform"
                >
                  −
                </button>
                <span className="font-display text-xl text-cb-gold font-bold w-6 text-center">
                  {item.quantidade}
                </span>
                <button
                  onClick={() => alterarQuantidade(index, item.quantidade + 1)}
                  className="w-10 h-10 rounded-full bg-cb-amber text-cb-espresso font-bold text-lg
                             touch-manipulation active:scale-90 transition-transform"
                >
                  +
                </button>
              </div>

              {/* Remover */}
              {confirmandoRemocao === index ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { removerItem(index); setConfirmandoRemocao(null); }}
                    className="text-xs bg-red-700 text-white px-3 py-1 rounded-full touch-manipulation"
                  >
                    Remover
                  </button>
                  <button
                    onClick={() => setConfirmandoRemocao(null)}
                    className="text-xs bg-cb-mocha border border-cb-caramel text-cb-latte px-3 py-1 rounded-full touch-manipulation"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmandoRemocao(index)}
                  className="text-cb-caramel text-sm touch-manipulation p-1"
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Sugestão de combo */}
        {sugerirCombo && (
          <button
            onClick={() => router.push("/cardapio")}
            className="bg-cb-leaf/20 border border-cb-mint rounded-2xl p-4 text-left touch-manipulation active:scale-[0.99] transition-transform"
          >
            <p className="font-sans font-semibold text-cb-mint text-base">🍰 Complete seu pedido!</p>
            <p className="font-sans text-cb-cream text-sm mt-1">
              Adicione um bolo ou sobremesa e monte um combo especial.
            </p>
          </button>
        )}

        {/* Espaçador */}
        <div className="h-4" />
      </div>

      {/* Rodapé com total e botões */}
      <div className="shrink-0 bg-cb-dark border-t border-cb-caramel/20 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="font-sans text-cb-latte text-lg">Total</span>
          <span className="font-display text-3xl text-cb-gold font-bold">
            {formatarMoeda(totalValor)}
          </span>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => router.push("/cardapio")}
            className="flex-1 border-2 border-cb-amber text-cb-amber font-bold font-sans text-lg
                       py-4 rounded-full touch-manipulation active:scale-95 transition-transform min-h-[64px]"
          >
            + Itens
          </button>
          <button
            onClick={() => router.push("/pagamento")}
            className="flex-[2] bg-cb-amber text-cb-espresso font-bold font-sans text-lg
                       py-4 rounded-full touch-manipulation active:scale-95 transition-transform min-h-[64px]"
          >
            Ir para Pagamento
          </button>
        </div>
      </div>
    </div>
  );
}
