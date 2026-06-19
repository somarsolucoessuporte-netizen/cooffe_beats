"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface PedidoFila {
  id: string;
  senha: string;
  status: "EM_PREPARO" | "PRONTO";
}

export default function FilaDeSenhas() {
  const router    = useRouter();
  const empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";
  const [pedidos, setPedidos] = useState<PedidoFila[]>([]);
  const [hora, setHora]       = useState("");
  const [conexao, setConexao] = useState<"conectando" | "ok" | "erro">("conectando");

  const buscar = useCallback(async function() {
    if (!empresaId) return;
    try {
      var res  = await fetch("/api/fila?empresaId=" + empresaId);
      var data = await res.json();
      if (data.ok) setPedidos(data.data);
    } catch(e) { /* silencioso — próximo poll tenta de novo */ }
  }, [empresaId]);

  // Relógio
  useEffect(function() {
    setHora(new Date().toLocaleTimeString("pt-BR"));
    var clock = setInterval(function() {
      setHora(new Date().toLocaleTimeString("pt-BR"));
    }, 1000);
    return function() { clearInterval(clock); };
  }, []);

  // Busca inicial
  useEffect(function() {
    buscar();
  }, [buscar]);

  // Realtime — mesmo canal que os routes emitem: `empresa-${empresaId}`
  useEffect(function() {
    if (!empresaId) return;

    var channel = supabase
      .channel("empresa-" + empresaId)
      .on("broadcast", { event: "pedido:novo" }, function() { buscar(); })
      .on("broadcast", { event: "pedido:atualizado" }, function() { buscar(); })
      .subscribe(function(status) {
        if (status === "SUBSCRIBED") setConexao("ok");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConexao("erro");
      });

    // Polling a cada 10s como fallback (garante consistência se WebSocket cair)
    var poll = setInterval(function() { buscar(); }, 10000);

    return function() {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [empresaId, buscar]);

  var emPreparo = pedidos.filter(function(p) { return p.status === "EM_PREPARO"; });
  var prontos   = pedidos.filter(function(p) { return p.status === "PRONTO"; });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5ECD7" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-10 py-5 border-b" style={{ background: "#EDE0C4", borderColor: "#D4C4A0" }}>
        <div className="flex items-center gap-4">
          <button
            onClick={function() { router.push("/"); }}
            className="flex items-center justify-center w-10 h-10 rounded-full
                       hover:bg-black/10 transition-colors touch-manipulation"
            title="Voltar"
            style={{ color: "#3B2415" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Coffee & Beats" className="h-12 object-contain" />
        </div>
        <div className="flex items-center gap-4">
          {/* Indicador de conexão */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              conexao === "ok" ? "bg-green-400" :
              conexao === "erro" ? "bg-red-400 animate-pulse" :
              "bg-yellow-400 animate-pulse"
            }`} />
            <span className="text-xs" style={{ color: "#7A6A55" }}>
              {conexao === "ok" ? "ao vivo" : conexao === "erro" ? "offline" : "conectando"}
            </span>
          </div>
          <div className="font-mono text-2xl font-bold" style={{ color: "#C8853A" }}>
            {hora}
          </div>
        </div>
      </div>

      {/* Grid de senhas */}
      <div className="flex-1 grid grid-cols-2 divide-x" style={{ borderColor: "#D4C4A0" }}>
        {/* EM PREPARO */}
        <div className="p-8 flex flex-col gap-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">☕</span>
            <h2 className="font-extrabold text-xl tracking-widest uppercase"
                style={{ color: "#C8853A" }}>
              Em Preparo
            </h2>
            {emPreparo.length > 0 && (
              <span className="ml-auto text-sm font-mono" style={{ color: "#7A6A55" }}>
                {emPreparo.length}
              </span>
            )}
          </div>

          {emPreparo.length === 0 ? (
            <p className="text-lg" style={{ color: "#7A6A55" }}>Nenhum pedido</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {emPreparo.map(function(p) {
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl px-6 py-4 border font-mono font-extrabold text-4xl
                               tracking-widest"
                    style={{
                      background: "rgba(200,133,58,0.15)",
                      borderColor: "#C8853A",
                      color: "#F6E8C8",
                    }}
                  >
                    {p.senha}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PRONTOS */}
        <div className="p-8 flex flex-col gap-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🎉</span>
            <h2 className="font-extrabold text-xl tracking-widest uppercase text-green-400">
              Pronto — Retire aqui!
            </h2>
            {prontos.length > 0 && (
              <span className="ml-auto text-sm font-mono" style={{ color: "#7A6A55" }}>
                {prontos.length}
              </span>
            )}
          </div>

          {prontos.length === 0 ? (
            <p className="text-lg" style={{ color: "#7A6A55" }}>Nenhum pedido</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {prontos.map(function(p) {
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl px-6 py-4 border font-mono font-extrabold text-4xl
                               tracking-widest animate-pulse"
                    style={{
                      background: "rgba(34,197,94,0.15)",
                      borderColor: "rgb(34,197,94)",
                      color: "rgb(134,239,172)",
                    }}
                  >
                    {p.senha}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 border-t" style={{ borderColor: "#D4C4A0" }}>
        <p className="text-sm tracking-widest uppercase" style={{ color: "#7A6A55" }}>
          Acompanhe seu pedido nessa tela
        </p>
      </div>
    </div>
  );
}
