"use client";

import { useRouter } from "next/navigation";
import { useCarrinho } from "@/contexts/CarrinhoContext";

interface HeaderTotemProps {
  mostrarVoltar?: boolean;
}

export default function HeaderTotem({ mostrarVoltar = true }: HeaderTotemProps) {
  const router = useRouter();
  const { totalItens } = useCarrinho();

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-cb-dark border-b border-cb-caramel/20">
      {/* Logo + Voltar */}
      <div className="flex items-center gap-4">
        {mostrarVoltar && (
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-cb-mocha text-cb-cream text-xl touch-manipulation active:scale-90 transition-transform"
          >
            ←
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-2xl">☕</span>
          <span className="font-display text-lg font-bold text-cb-gold">Coffee & Beats</span>
        </div>
      </div>

      {/* Indicador de carrinho */}
      <button
        onClick={() => router.push("/carrinho")}
        className="relative flex items-center gap-2 bg-cb-mocha px-4 py-3 rounded-2xl touch-manipulation active:scale-95 transition-transform min-h-[56px]"
      >
        <span className="text-xl">🛒</span>
        <span className="font-sans text-cb-cream font-medium">Carrinho</span>
        {totalItens > 0 && (
          <span className="absolute -top-2 -right-2 bg-cb-amber text-cb-espresso font-bold text-sm w-6 h-6 rounded-full flex items-center justify-center">
            {totalItens}
          </span>
        )}
      </button>
    </header>
  );
}
