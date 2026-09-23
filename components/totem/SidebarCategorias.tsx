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
    // Largura maior pra caber fonte 18px + ícone 28px no touch do SUNMI D2 Mini
    <aside className="w-52 h-full shrink-0 bg-cb-marrom flex flex-col">
      <div className="flex items-center gap-2 px-3 py-4 border-b border-white/10 shrink-0">
        <span className="text-lg">☕</span>
        <span className="font-sans font-extrabold text-[11px] text-cb-bege leading-tight">
          Coffee & Beats
        </span>
      </div>

      {/* Scroll suave + inércia no touch para listas longas de categorias */}
      <nav className="flex-1 overflow-y-auto overscroll-contain scroll-smooth [-webkit-overflow-scrolling:touch]
                      totem-scroll flex flex-col gap-1 py-1">
        {categorias.map((cat) => {
          const ativa = categoriaAtiva === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => { playClick(); onChange(cat.id); }}
              className={`
                flex items-center gap-3 text-left min-h-[56px] py-[14px] px-[14px]
                text-[18px] leading-tight font-sans font-semibold
                border-l-4 touch-manipulation btn-totem transition-colors
                ${
                  ativa
                    ? "border-cb-gold bg-cb-gold/10 text-cb-bege"
                    : "border-transparent text-white/55 hover:text-white/85"
                }
              `}
            >
              <span className="text-[28px] leading-none shrink-0">{cat.emoji}</span>
              {/* Quebra em até 2 linhas em vez de cortar o nome */}
              <span className="line-clamp-2 break-words">{cat.nome}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
