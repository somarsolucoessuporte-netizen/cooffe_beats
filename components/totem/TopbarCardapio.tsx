"use client";

import { useRouter } from "next/navigation";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import { playClick } from "@/lib/sounds";

interface TopbarCardapioProps {
  nomeCategoriaAtiva: string;
}

export default function TopbarCardapio({ nomeCategoriaAtiva }: TopbarCardapioProps) {
  const router = useRouter();
  const { totalItens } = useCarrinho();

  return (
    <header className="h-10 flex items-center justify-between px-4 bg-cb-caramel shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => { playClick(); router.back(); }}
          className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10
                     text-cb-bege text-sm touch-manipulation btn-totem shrink-0"
        >
          ←
        </button>
        <span className="font-sans font-semibold text-[12px] text-cb-gold truncate">
          {nomeCategoriaAtiva}
        </span>
      </div>

      <button
        onClick={() => { playClick(); router.push("/carrinho"); }}
        className="relative flex items-center justify-center w-7 h-7 rounded-full
                   bg-white/10 touch-manipulation btn-totem shrink-0"
      >
        <span className="text-sm">🛒</span>
        {totalItens > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-cb-gold text-cb-marrom font-bold
                           text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
            {totalItens}
          </span>
        )}
      </button>
    </header>
  );
}
