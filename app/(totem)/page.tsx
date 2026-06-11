"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { formatarHora } from "@/lib/utils";

export default function TelaInicial() {
  const router = useRouter();
  const [hora, setHora] = useState("");
  const [pulsando, setPulsando] = useState(false);

  const irParaCardapio = useCallback(() => {
    router.push("/cardapio");
  }, [router]);

  // Atualiza horário a cada minuto
  useEffect(() => {
    const atualizar = () => setHora(formatarHora(new Date()));
    atualizar();
    const interval = setInterval(atualizar, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Ativa pulse no CTA após 30s sem interação
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const resetar = () => {
      clearTimeout(timer);
      setPulsando(false);
      timer = setTimeout(() => setPulsando(true), 30_000);
    };
    resetar();
    window.addEventListener("touchstart", resetar);
    window.addEventListener("click", resetar);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("touchstart", resetar);
      window.removeEventListener("click", resetar);
    };
  }, []);

  return (
    <main className="relative h-full w-full flex flex-col items-center justify-center select-none">
      {/* Ondas sonoras decorativas */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="flex items-end gap-2 opacity-20">
          {[0.3, 0.7, 1, 0.6, 0.9, 0.4, 0.8, 0.5, 1, 0.7, 0.3].map((h, i) => (
            <div
              key={i}
              className="soundwave-bar w-3 rounded-full bg-cb-amber"
              style={{
                height: `${h * 200}px`,
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Conteúdo central */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-8 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-6xl">☕</div>
          <h1 className="font-display text-4xl font-bold text-cb-gold tracking-wide">
            Coffee & Beats
          </h1>
        </div>

        {/* Título de boas-vindas */}
        <div className="flex flex-col gap-3">
          <p className="font-display text-5xl text-cb-cream leading-tight">
            Bem-vindo à
            <br />
            <span className="text-cb-gold">Coffee & Beats</span>
          </p>
          <p className="font-sans text-xl text-cb-latte">
            Onde o café encontra o ritmo da sua vida
          </p>
        </div>

        {/* Botão CTA */}
        <button
          onClick={irParaCardapio}
          className={`
            mt-4 bg-cb-amber text-cb-espresso font-sans font-bold
            text-2xl py-6 px-16 rounded-full
            transition-transform active:scale-95
            min-h-[80px] touch-manipulation
            ${pulsando ? "cta-pulse" : ""}
          `}
        >
          FAZER PEDIDO
        </button>
      </div>

      {/* Horário no canto inferior direito */}
      <div className="absolute bottom-6 right-8">
        <span className="font-mono text-cb-caramel text-lg">{hora}</span>
      </div>
    </main>
  );
}
