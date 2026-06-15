"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { playClick } from "@/lib/sounds";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { imprimirComanda } from "@/lib/imprimir-comanda";

const STATUS_INFO: Record<string, { icone: string; texto: string; cor: string }> = {
  RECEBIDO:   { icone: "⏳", texto: "Recebido",                     cor: "text-cb-amber" },
  EM_PREPARO: { icone: "☕", texto: "Preparando seu pedido...",      cor: "text-blue-500" },
  PRONTO:     { icone: "🎉", texto: "Pronto! Retire no balcão",      cor: "text-green-500" },
  ENTREGUE:   { icone: "✅", texto: "Entregue. Bom proveito!",       cor: "text-cb-marrom/50" },
};

const impressaoAtiva = process.env.NEXT_PUBLIC_IMPRESSAO_ATIVA !== "false";

function ConfirmacaoConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const senha     = searchParams.get("senha") ?? "CB-???";
  const pedidoId  = searchParams.get("id")    ?? "";

  const [mostrarBotao, setMostrarBotao] = useState(false);
  const [progresso, setProgresso]       = useState(100);
  const [statusAtual, setStatusAtual]   = useState("RECEBIDO");
  const tempoEstimado = 5;
  const duracao       = tempoEstimado * 60 * 1000;
  const inicioRef     = useRef(Date.now());
  const impressaoDisparadaRef = useRef(false);

  // Busca status inicial + dados do pedido para impressão + escuta realtime
  useEffect(() => {
    if (!pedidoId) return;

    fetch(`/api/pedidos/${pedidoId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setStatusAtual(d.data.status);

        // Impressão automática — dispara apenas uma vez
        if (impressaoAtiva && !impressaoDisparadaRef.current) {
          impressaoDisparadaRef.current = true;

          const pedido = d.data;

          // Monta itens no formato esperado por imprimirComanda
          const itens = (pedido.itens ?? []).map((item: {
            quantidade: number;
            produto: { nome: string };
            adicionais: { adicional: { nome: string } }[];
            observacao?: string | null;
          }) => ({
            nome: item.produto.nome,
            quantidade: item.quantidade,
            adicionais: item.adicionais.map((a) => a.adicional.nome),
            observacao: item.observacao ?? undefined,
          }));

          const total: number = pedido.total ?? 0;

          // Via cliente — imediata
          imprimirComanda({ senha: pedido.senha, itens, total, via: "CLIENTE" });

          // Via cozinha — 1 s depois para não sobrepor diálogos
          setTimeout(() => {
            imprimirComanda({ senha: pedido.senha, itens, total, via: "COZINHA" });
          }, 1000);
        }
      })
      .catch(() => {});

    const empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";
    const channel = supabase
      .channel(`empresa-${empresaId}`)
      .on("broadcast", { event: "pedido:atualizado" }, ({ payload }) => {
        if ((payload as { id: string }).id === pedidoId) {
          setStatusAtual((payload as { status: string }).status);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pedidoId]);

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
      const restante  = Math.max(0, 100 - (decorrido / duracao) * 100);
      setProgresso(restante);
      if (restante === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [duracao]);

  const info = STATUS_INFO[statusAtual] ?? STATUS_INFO.RECEBIDO;

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

      {/* Status em tempo real */}
      <div className={`flex items-center gap-3 text-2xl font-extrabold transition-all ${info.cor}
                       ${statusAtual === "PRONTO" ? "animate-pulse" : ""}`}>
        <span>{info.icone}</span>
        <span>{info.texto}</span>
      </div>

      {/* Barra de progresso */}
      <div className="w-full max-w-sm bg-cb-marrom/10 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-cb-amber rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progresso}%` }}
        />
      </div>

      <p className="text-cb-marrom/50 text-base">Previsão: ~{tempoEstimado} minutos</p>

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
