"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { playClick } from "@/lib/sounds";

const PARTICLES = [
  { top: "12%", left: "8%",  size: 6, dur: "9s",   delay: "0s" },
  { top: "25%", left: "88%", size: 4, dur: "7s",   delay: "1.2s" },
  { top: "55%", left: "5%",  size: 5, dur: "11s",  delay: "2.5s" },
  { top: "70%", left: "92%", size: 7, dur: "8s",   delay: "0.7s" },
  { top: "80%", left: "20%", size: 4, dur: "12s",  delay: "3s" },
  { top: "15%", left: "50%", size: 5, dur: "10s",  delay: "1.8s" },
  { top: "45%", left: "95%", size: 6, dur: "9s",   delay: "4s" },
  { top: "90%", left: "60%", size: 4, dur: "13s",  delay: "0.5s" },
  { top: "35%", left: "3%",  size: 5, dur: "7.5s", delay: "2s" },
];

export default function Home() {
  const router = useRouter();
  const [fase, setFase] = useState(0);
  const [logoError, setLogoError] = useState(false);
  const [hora, setHora] = useState("");

  useEffect(() => {
    setHora(new Date().toLocaleTimeString("pt-BR"));
    const clock    = setInterval(() => setHora(new Date().toLocaleTimeString("pt-BR")), 1_000);
    const t1       = setTimeout(() => setFase(1), 500);
    const t2       = setTimeout(() => setFase(2), 1_500);
    const t3       = setTimeout(() => setFase(3), 2_500);
    const redirect = setTimeout(() => router.push("/cardapio"), 30_000);
    return () => {
      clearInterval(clock);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(redirect);
    };
  }, [router]);

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ background: "linear-gradient(135deg, #F5EDD6 0%, #EDE0C4 50%, #E8D5B0 100%)" }}
      onClick={() => { playClick(); router.push("/cardapio"); }}
    >
      {/* Partículas de fundo */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="particle absolute rounded-full pointer-events-none"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            background: "rgba(146,64,14,0.20)",
            "--dur": p.dur,
            "--delay": p.delay,
          } as React.CSSProperties}
        />
      ))}

      <div className="flex flex-col items-center gap-8 px-8 text-center">
        {/* Fase 1 — Logo (sem filter, cores originais) */}
        {fase >= 1 && (
          !logoError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo.png"
              alt="Coffee & Beats"
              className={`w-44 h-44 object-contain ${fase >= 2 ? "logo-pulse" : "logo-reveal"}`}
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="logo-reveal text-8xl">☕</span>
          )
        )}

        {/* Fase 2 — Slogan */}
        {fase >= 2 && (
          <p className="slide-up text-xl text-amber-800/80">
            Onde o café encontra o ritmo da sua vida
          </p>
        )}

        {/* Fase 3 — Botão */}
        {fase >= 3 && (
          <div className="slide-up flex flex-col items-center gap-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                playClick();
                router.push("/cardapio");
              }}
              className="mt-2 bg-amber-900 text-amber-400 font-bold font-sans text-2xl
                         py-6 px-16 rounded-full hover:bg-amber-800 min-h-[80px]
                         touch-manipulation btn-totem cta-pulse"
            >
              FAZER PEDIDO
            </button>
            <p className="text-amber-700/60 text-sm">Toque em qualquer lugar para começar</p>
          </div>
        )}
      </div>

      {/* Relógio */}
      {hora && (
        <div className="absolute bottom-6 right-8 font-mono text-sm text-amber-800/50 select-none">
          {hora}
        </div>
      )}
    </div>
  );
}
