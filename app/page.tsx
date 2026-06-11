"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { playClick } from "@/lib/sounds";

export default function Home() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [hora, setHora] = useState("");

  useEffect(() => {
    setVisible(true);
    setHora(new Date().toLocaleTimeString("pt-BR"));
    const clock = setInterval(
      () => setHora(new Date().toLocaleTimeString("pt-BR")),
      1_000
    );
    const redirect = setTimeout(() => router.push("/cardapio"), 30_000);
    return () => {
      clearInterval(clock);
      clearTimeout(redirect);
    };
  }, [router]);

  return (
    <div
      className={`h-screen w-screen flex flex-col items-center justify-center select-none
                  transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
      style={{ background: "#1A0A00" }}
      onClick={() => { playClick(); router.push("/cardapio"); }}
    >
      <div className="flex flex-col items-center gap-8 px-8 text-center animate-fadeIn">
        {/* Logo — tenta /logo.png, fallback para emoji */}
        {!logoError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/logo.png"
            alt="Coffee & Beats"
            className="w-44 h-44 object-contain"
            style={{ filter: "sepia(1) saturate(5) hue-rotate(5deg) brightness(0.9)" }}
            onError={() => setLogoError(true)}
          />
        ) : (
          <span className="text-8xl">☕</span>
        )}

        <p className="text-xl text-amber-100/70">
          Onde o café encontra o ritmo da sua vida
        </p>

        <button
          onClick={(e) => {
            e.stopPropagation();
            playClick();
            router.push("/cardapio");
          }}
          className="mt-4 bg-amber-500 text-stone-900 font-bold font-sans text-2xl
                     py-6 px-16 rounded-full hover:bg-amber-400 min-h-[80px]
                     touch-manipulation btn-totem cta-pulse"
        >
          FAZER PEDIDO
        </button>

        <p className="text-amber-900/60 text-sm">Toque em qualquer lugar para começar</p>
      </div>

      {/* Relógio — canto inferior direito */}
      {hora && (
        <div className="absolute bottom-6 right-8 font-mono text-sm text-amber-900/50 select-none">
          {hora}
        </div>
      )}
    </div>
  );
}
