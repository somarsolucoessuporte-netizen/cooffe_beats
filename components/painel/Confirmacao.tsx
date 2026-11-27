"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Confirmar = (mensagem: string) => Promise<boolean>;

const Contexto = createContext<Confirmar | null>(null);

/** Confirmação dentro da própria página. Janelas nativas do navegador travam o totem. */
export function useConfirmar(): Confirmar {
  const confirmar = useContext(Contexto);
  if (!confirmar) throw new Error("useConfirmar precisa de ConfirmacaoProvider");
  return confirmar;
}

export function ConfirmacaoProvider({ children }: { children: React.ReactNode }) {
  const [mensagem, setMensagem] = useState<string | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const responder = useCallback((valor: boolean) => {
    resolver.current?.(valor);
    resolver.current = null;
    setMensagem(null);
  }, []);

  const confirmar = useCallback<Confirmar>((texto) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setMensagem(texto);
  }), []);

  return (
    <Contexto.Provider value={confirmar}>
      {children}
      {mensagem !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div role="alertdialog" aria-modal="true" aria-label="Confirmação"
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-5">
            <p className="text-[#3B2415] font-medium whitespace-pre-line">{mensagem}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => responder(false)}
                className="flex-1 py-3 rounded-xl border border-[#3B2415]/20 text-[#3B2415] font-medium">
                Cancelar
              </button>
              <button type="button" onClick={() => responder(true)}
                className="flex-1 py-3 rounded-xl bg-[#3B2415] text-[#F6F0E5] font-bold">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </Contexto.Provider>
  );
}
