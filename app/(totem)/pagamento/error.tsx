"use client";

import { useEffect } from "react";

// Qualquer exceção de renderização na tela de pagamento cai aqui: nunca tela branca ou travada.
export default function ErroPagamento({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[Pagamento] erro de renderização:", error); }, [error]);

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-5 p-8 text-center bg-cb-bege">
      <h1 className="font-sans font-extrabold text-3xl text-cb-marrom">Algo deu errado no pagamento</h1>
      <p className="text-cb-marrom/70 text-lg max-w-md">Seu carrinho está salvo. Volte e tente de novo.</p>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={function() { reset(); }}
          className="w-full bg-cb-marrom text-white font-bold text-lg py-4 rounded-2xl touch-manipulation"
        >
          Voltar ao pagamento
        </button>
        <button
          onClick={function() { window.location.assign("/carrinho"); }}
          className="w-full border-2 border-cb-marrom/30 text-cb-marrom font-bold text-lg py-4 rounded-2xl touch-manipulation"
        >
          Voltar ao carrinho
        </button>
      </div>
    </div>
  );
}
