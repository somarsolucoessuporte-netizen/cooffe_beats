"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { playClick } from "@/lib/sounds";

export default function Home() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => router.push("/cardapio"), 30_000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div
      className={`h-screen w-screen flex flex-col items-center justify-center select-none transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
      style={{ background: "#1A0A00" }}
      onClick={() => { playClick(); router.push("/cardapio"); }}
    >
      <div className="flex flex-col items-center gap-8 px-8 text-center animate-fadeIn">
        <div className="text-8xl">☕</div>

        <div className="flex flex-col gap-3">
          <h1 className="font-display text-6xl font-bold text-amber-400 tracking-wide">
            Coffee & Beats
          </h1>
          <p className="text-xl text-amber-100/70">
            Onde o café encontra o ritmo da sua vida
          </p>
        </div>

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
    </div>
  );
}
