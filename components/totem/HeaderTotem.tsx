"use client";

import { useRouter } from "next/navigation";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import { playClick } from "@/lib/sounds";

interface HeaderTotemProps {
  mostrarVoltar?: boolean;
}

export default function HeaderTotem({ mostrarVoltar = true }: HeaderTotemProps) {
  const router = useRouter();
  const { totalItens } = useCarrinho();

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-cb-dark border-b border-cb-caramel/20 shrink-0">
      {/* Logo + Voltar */}
      <div className="flex items-center gap-3">
        {mostrarVoltar && (
          <button
            onClick={() => { playClick(); router.back(); }}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-cb-mocha text-cb-cream text-lg touch-manipulation btn-totem"
          >
            ←
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xl">☕</span>
          <span className="font-display text-base font-bold text-cb-gold">Coffee & Beats</span>
        </div>
      </div>

      {/* Indicador de carrinho */}
      <button
        onClick={() => { playClick(); router.push("/carrinho"); }}
        className="relative flex items-center gap-2 bg-cb-mocha px-3 py-2 rounded-xl touch-manipulation btn-totem"
      >
        <span className="text-lg">🛒</span>
        <span className="font-sans text-cb-cream font-medium text-sm">Carrinho</span>
        {totalItens > 0 && (
          <span className="absolute -top-2 -right-2 bg-cb-amber text-cb-espresso font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center">
            {totalItens}
          </span>
        )}
      </button>
    </header>
  );
}
