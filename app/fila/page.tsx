"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface PedidoFila {
  id: string;
  senha: string;
  status: "EM_PREPARO" | "PRONTO";
}

export default function FilaDeSenhas() {
  const empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";
  const [pedidos, setPedidos] = useState<PedidoFila[]>([]);
  const [hora, setHora]       = useState("");

  const buscar = async () => {
    if (!empresaId) return;
    const res  = await fetch(`/api/fila?empresaId=${empresaId}`);
    const data = await res.json();
    if (data.ok) setPedidos(data.data);
  };

  useEffect(() => {
    buscar();
    setHora(new Date().toLocaleTimeString("pt-BR"));
    const clock = setInterval(() => setHora(new Date().toLocaleTimeString("pt-BR")), 1_000);
    return () => clearInterval(clock);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!empresaId) return;
    const channel = supabase
      .channel(`empresa-${empresaId}-fila`)
      .on("broadcast", { event: "pedido:novo" }, () => buscar())
      .on("broadcast", { event: "pedido:atualizado" }, () => buscar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const emPreparo = pedidos.filter((p) => p.status === "EM_PREPARO");
  const prontos   = pedidos.filter((p) => p.status === "PRONTO");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#3B2415" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-10 py-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Coffee & Beats" className="h-12 object-contain" />
        </div>
        <div className="font-mono text-2xl font-bold" style={{ color: "#C8853A" }}>
          {hora}
        </div>
      </div>

      {/* Grid de senhas */}
      <div className="flex-1 grid grid-cols-2 divide-x divide-white/10 p-0">
        {/* EM PREPARO */}
        <div className="p-8 flex flex-col gap-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">☕</span>
            <h2 className="font-extrabold text-xl tracking-widest uppercase"
                style={{ color: "#C8853A" }}>
              Em Preparo
            </h2>
          </div>

          {emPreparo.length === 0 ? (
            <p className="text-white/20 text-lg">Nenhum pedido</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {emPreparo.map((p) => (
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
              ))}
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
          </div>

          {prontos.length === 0 ? (
            <p className="text-white/20 text-lg">Nenhum pedido</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {prontos.map((p) => (
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
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 border-t border-white/10">
        <p className="text-white/20 text-sm tracking-widest uppercase">
          Acompanhe seu pedido nessa tela
        </p>
      </div>
    </div>
  );
}
