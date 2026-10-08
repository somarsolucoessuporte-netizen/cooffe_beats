"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { UtensilsCrossed, CalendarDays, User, ShoppingCart } from "lucide-react";
import { useWebCarrinho } from "@/contexts/WebCarrinhoContext";

// Rotas públicas onde a barra não aparece
const ROTAS_SEM_BARRA = ["/web/login", "/web/termos"];

const ITENS = [
  { href: "/web/cardapio", label: "Cardápio",    Icone: UtensilsCrossed },
  { href: "/web/reservas", label: "Reservas",    Icone: CalendarDays },
  { href: "/web/conta",    label: "Minha Conta", Icone: User },
  { href: "/web/carrinho", label: "Carrinho",    Icone: ShoppingCart },
];

// Barra de navegação inferior — só no mobile (< 768px)
export default function MobileBottomNav() {
  const pathname = usePathname();
  const { totalItens } = useWebCarrinho();

  if (ROTAS_SEM_BARRA.some(function (r) { return pathname.startsWith(r); })) return null;

  return (
    <>
      {/* Espaço reservado para o conteúdo não ficar atrás da barra */}
      <div className="md:hidden h-[calc(64px+env(safe-area-inset-bottom))]" />

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white shadow-[0_-2px_12px_rgba(59,36,21,0.08)]
                   pb-[env(safe-area-inset-bottom)]"
      >
        <div className="h-16 grid grid-cols-4">
          {ITENS.map(function ({ href, label, Icone }) {
            const ativo = pathname.startsWith(href);
            return (
              <Link key={href} href={href} className="flex items-center justify-center">
                <motion.span
                  whileTap={{ scale: 0.9 }}
                  className={
                    "flex flex-col items-center gap-1 text-[11px] font-semibold " +
                    (ativo ? "text-[#3B2415]" : "text-gray-400")
                  }
                >
                  <span className="relative">
                    <Icone size={22} strokeWidth={ativo ? 2.4 : 2} />
                    {href === "/web/carrinho" && totalItens > 0 && (
                      <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full
                                       bg-[#C8A96E] text-[#3B2415] text-[10px] font-bold flex items-center justify-center">
                        {totalItens}
                      </span>
                    )}
                  </span>
                  {label}
                </motion.span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
