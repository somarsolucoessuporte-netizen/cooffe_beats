"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { UtensilsCrossed, CalendarDays, User, ShoppingCart } from "lucide-react";
import { useWebCarrinho } from "@/contexts/WebCarrinhoContext";

// Rotas públicas onde a barra não aparece
const ROTAS_SEM_BARRA = ["/web/login", "/web/termos"];

// Cardápio da mesa (sem login): Reservas e Minha Conta exigem conta, então ficam de fora
const ITENS_MESA = [
  { href: "/web/m",          label: "Cardápio", Icone: UtensilsCrossed },
  { href: "/web/m/carrinho", label: "Carrinho", Icone: ShoppingCart },
];

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

  const modoMesa = pathname === "/web/m" || pathname.startsWith("/web/m/");
  const itens    = modoMesa ? ITENS_MESA : ITENS;
  // No modo mesa a barra aparece sempre; no portal, só em tela mobile
  const classeVisivel = modoMesa ? "block" : "cb-so-mobile";

  // Item ativo: o href mais específico que casa com a rota atual
  const ativoHref = itens
    .filter(function (i) { return pathname === i.href || pathname.startsWith(i.href + "/"); })
    .sort(function (a, b) { return b.href.length - a.href.length; })[0]?.href;

  return (
    <>
      {/* Espaço reservado para o conteúdo não ficar atrás da barra */}
      <div className={classeVisivel + " h-[calc(64px+env(safe-area-inset-bottom))]"} />

      <nav
        className={
          classeVisivel + " fixed bottom-0 inset-x-0 z-40 bg-white shadow-[0_-2px_12px_rgba(59,36,21,0.08)] " +
          "pb-[env(safe-area-inset-bottom)]"
        }
      >
        <div className={"h-16 grid " + (modoMesa ? "grid-cols-2" : "grid-cols-4")}>
          {itens.map(function ({ href, label, Icone }) {
            const ativo = href === ativoHref;
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
                    {href.endsWith("/carrinho") && totalItens > 0 && (
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
