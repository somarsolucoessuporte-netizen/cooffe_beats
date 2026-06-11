"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { playClick } from "@/lib/sounds";
import { useRouter, useSearchParams } from "next/navigation";

function ConfirmacaoConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const senha = searchParams.get("senha") ?? "CB-???";

  const [mostrarBotao, setMostrarBotao] = useState(false);
  const [progresso, setProgresso] = useState(100);
  const tempoEstimado = 5;
  const duracao = tempoEstimado * 60 * 1000;
  const inicioRef = useRef(Date.now());

  useEffect(() => {
    const t = setTimeout(() => setMostrarBotao(true), 8_000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => router.push("/"), 30_000);
    return () => clearTimeout(t);
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      const decorrido = Date.now() - inicioRef.current;
      const restante = Math.max(0, 100 - (decorrido / duracao) * 100);
      setProgresso(restante);
      if (restante === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [duracao]);

  return (
    <main className="h-full flex flex-col items-center justify-center gap-8 px-8 text-center animate-fadeIn">
      {/* Check */}
      <div className="check-circle">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="56" fill="#F6F0E5" stroke="#C8853A" strokeWidth="4" />
          <path
            className="check-path"
            d="M30 62 L50 82 L90 40"
            stroke="#3B2415"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Senha */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-cb-marrom/60 text-lg">Seu número de pedido</p>
        <div className="font-mono text-7xl text-cb-marrom bg-white rounded-3xl px-8 py-5
                        border border-cb-marrom/10 tracking-widest shadow-sm">
          {senha}
        </div>
      </div>

      {/* Mensagem */}
      <div className="flex flex-col gap-2">
        <p className="font-sans font-extrabold text-2xl text-cb-marrom">
          Seu pedido está sendo preparado com carinho ☕
        </p>
        <p className="text-cb-marrom/60 text-lg">Previsão: ~{tempoEstimado} minutos</p>
      </div>

      {/* Barra de progresso */}
      <div className="w-full max-w-sm bg-cb-marrom/10 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-cb-amber rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progresso}%` }}
        />
      </div>

      {mostrarBotao && (
        <button
          onClick={() => { playClick(); router.push("/"); }}
          className="fade-in bg-cb-marrom text-cb-bege font-extrabold font-sans text-xl
                     py-5 px-12 rounded-full touch-manipulation btn-totem min-h-[72px]"
        >
          Fazer Novo Pedido
        </button>
      )}
    </main>
  );
}

export default function Confirmacao() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center text-cb-marrom/50">
        Carregando...
      </div>
    }>
      <ConfirmacaoConteudo />
    </Suspense>
  );
}
