"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import { formatarMoeda } from "@/lib/utils";
import { playClick } from "@/lib/sounds";

const ROTAS_OCULTAS = ["/carrinho", "/pagamento", "/confirmacao", "/mesa"];

export default function BotaoCarrinhoFlutuante() {
  const { totalItens, totalValor } = useCarrinho();
  const router   = useRouter();
  const pathname = usePathname();

  if (totalItens === 0) return null;
  if (ROTAS_OCULTAS.some(function(r) { return pathname.startsWith(r); })) return null;

  return (
    <button
      onClick={function() { playClick(); router.push("/carrinho"); }}
      className="btn-float-cart fixed bottom-6 right-6 z-50
                 flex items-center gap-3 bg-cb-marrom text-cb-bege
                 font-extrabold px-6 py-4 rounded-2xl min-h-[64px]
                 touch-manipulation"
    >
      <span className="text-xl">🛒</span>
      <span className="text-base leading-tight">
        Finalizar Pedido<br />
        <span className="text-cb-amber">{formatarMoeda(totalValor)}</span>
      </span>
    </button>
  );
}
