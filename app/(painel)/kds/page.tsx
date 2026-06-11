"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { calcularTempoDecorrido } from "@/lib/utils";

interface ItemAdicional {
  adicional: { nome: string };
}

interface ItemPedido {
  id: string;
  quantidade: number;
  observacao: string | null;
  produto: { nome: string };
  adicionais: ItemAdicional[];
}

interface Pedido {
  id: string;
  senha: string;
  status: string;
  criadoEm: string;
  iniciadoEm: string | null;
  observacao: string | null;
  itens: ItemPedido[];
}

function corCard(pedido: Pedido): string {
  const inicio = pedido.iniciadoEm ?? pedido.criadoEm;
  const diffMin = (Date.now() - new Date(inicio).getTime()) / 60_000;
  if (diffMin < 5) return "border-green-500 bg-green-900/10";
  if (diffMin < 10) return "border-yellow-500 bg-yellow-900/10";
  return "border-red-500 bg-red-900/15";
}

export default function KDS() {
  const { data: session } = useSession();
  const empresaId = (session?.user as { empresaId?: string })?.empresaId ?? "";
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [tick, setTick] = useState(0);

  const buscarPedidos = useCallback(async () => {
    if (!empresaId) return;
    const res = await fetch(`/api/pedidos?empresaId=${empresaId}`);
    const dados = await res.json();
    if (dados.ok) {
      setPedidos(
        dados.data.filter((p: Pedido) =>
          ["RECEBIDO", "EM_PREPARO"].includes(p.status)
        )
      );
    }
  }, [empresaId]);

  useEffect(() => {
    buscarPedidos();
  }, [buscarPedidos]);

  // Atualiza o tick a cada 30s para recalcular cores
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime — atualizações em tempo real
  useEffect(() => {
    if (!empresaId) return;

    const channel = supabase
      .channel(`empresa-${empresaId}`)
      .on("broadcast", { event: "pedido:novo" }, ({ payload }) => {
        setPedidos((prev) => [payload as Pedido, ...prev]);
      })
      .on("broadcast", { event: "pedido:atualizado" }, ({ payload }) => {
        const { id, status } = payload as { id: string; status: string };
        if (["PRONTO", "ENTREGUE", "CANCELADO"].includes(status)) {
          setPedidos((prev) => prev.filter((p) => p.id !== id));
        } else {
          setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresaId]);

  const atualizarStatus = useCallback(async (pedidoId: string, status: string) => {
    await fetch(`/api/pedidos/${pedidoId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }, []);

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="px-8 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">KDS — Barista</h1>
          <p className="text-zinc-400 text-sm">{pedidos.length} pedido(s) em aberto</p>
        </div>
        <div className="text-zinc-500 text-sm font-mono">{new Date().toLocaleTimeString("pt-BR")}</div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {pedidos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-zinc-600">
            <span className="text-6xl">☕</span>
            <p className="text-xl">Nenhum pedido em aberto</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-5">
            {pedidos.map((pedido) => (
              <div
                key={`${pedido.id}-${tick}`}
                className={`border-2 rounded-2xl p-5 flex flex-col gap-4 ${corCard(pedido)}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <span className="font-mono font-bold text-cb-amber text-3xl">{pedido.senha}</span>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      pedido.status === "EM_PREPARO"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}>
                      {pedido.status === "EM_PREPARO" ? "EM PREPARO" : "RECEBIDO"}
                    </span>
                    <p className="text-zinc-500 text-xs mt-1">
                      {calcularTempoDecorrido(pedido.iniciadoEm ?? pedido.criadoEm)}
                    </p>
                  </div>
                </div>

                {/* Itens */}
                <div className="flex flex-col gap-2 flex-1">
                  {pedido.itens.map((item) => (
                    <div key={item.id} className="bg-zinc-900/60 rounded-xl p-3">
                      <p className="font-bold text-zinc-100 text-lg">
                        {item.quantidade}x {item.produto.nome}
                      </p>
                      {item.adicionais.length > 0 && (
                        <p className="text-sm text-zinc-400 mt-1">
                          + {item.adicionais.map((a) => a.adicional.nome).join(", ")}
                        </p>
                      )}
                      {item.observacao && (
                        <p className="text-sm text-cb-amber mt-1 font-medium">
                          ⚠ {item.observacao}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Observação geral */}
                {pedido.observacao && (
                  <div className="bg-cb-amber/10 border border-cb-amber/30 rounded-xl px-4 py-3">
                    <p className="text-cb-amber text-sm font-medium">📝 {pedido.observacao}</p>
                  </div>
                )}

                {/* Botões de ação */}
                <div className="flex gap-3 mt-auto">
                  {pedido.status === "RECEBIDO" && (
                    <button
                      onClick={() => atualizarStatus(pedido.id, "EM_PREPARO")}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors text-lg"
                    >
                      INICIAR
                    </button>
                  )}
                  {pedido.status === "EM_PREPARO" && (
                    <button
                      onClick={() => atualizarStatus(pedido.id, "PRONTO")}
                      className="flex-1 bg-cb-amber text-cb-espresso font-bold py-3 rounded-xl transition-opacity hover:opacity-90 text-lg"
                    >
                      PRONTO
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
