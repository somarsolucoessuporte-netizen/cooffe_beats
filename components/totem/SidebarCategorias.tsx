"use client";

import { playClick } from "@/lib/sounds";

interface Categoria {
  id: string;
  nome: string;
  emoji: string;
  ordem: number;
}

interface SidebarCategoriasProps {
  categorias: Categoria[];
  categoriaAtiva: string;
  onChange: (categoriaId: string) => void;
}

export default function SidebarCategorias({
  categorias,
  categoriaAtiva,
  onChange,
}: SidebarCategoriasProps) {
  return (
    <aside className="w-40 h-full shrink-0 bg-cb-marrom flex flex-col">
      <div className="flex items-center gap-2 px-3 py-4 border-b border-white/10 shrink-0">
        <span className="text-lg">☕</span>
        <span className="font-sans font-extrabold text-[11px] text-cb-bege leading-tight">
          Coffee & Beats
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto totem-scroll flex flex-col py-1">
        {categorias.map((cat) => {
          const ativa = categoriaAtiva === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => { playClick(); onChange(cat.id); }}
              className={`
                flex items-center gap-2 text-left py-[7px] px-[14px]
                text-[10px] font-sans font-semibold whitespace-nowrap
                border-l-2 touch-manipulation btn-totem transition-colors
                ${
                  ativa
                    ? "border-cb-gold bg-cb-gold/10 text-cb-bege"
                    : "border-transparent text-white/55 hover:text-white/85"
                }
              `}
            >
              <span className="text-xs">{cat.emoji}</span>
              <span className="truncate">{cat.nome}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
