"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { calcularTempoDecorrido } from "@/lib/utils";
import { imprimirComanda } from "@/lib/imprimir-comanda";

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
  origem: string;
  previsaoChegada: string | null;
  pago: boolean;
  pagamentoAntecipado: boolean;
  itens: ItemPedido[];
}

function corCard(pedido: Pedido): string {
  // Pedidos online: urgência baseada na previsão de chegada do cliente
  if (pedido.origem === "APP" && pedido.previsaoChegada) {
    const minRestantes = (new Date(pedido.previsaoChegada).getTime() - Date.now()) / 60_000;
    if (minRestantes < 0)  return "border-red-400 bg-red-900/25";   // passou do horário
    if (minRestantes <= 15) return "border-amber-400 bg-amber-900/15"; // menos de 15min
  }
  // Pedidos normais: baseado no tempo desde início do preparo
  const inicio = pedido.iniciadoEm ?? pedido.criadoEm;
  const diffMin = (Date.now() - new Date(inicio).getTime()) / 60_000;
  if (diffMin < 5)  return "border-green-500 bg-green-900/10";
  if (diffMin < 10) return "border-yellow-500 bg-yellow-900/10";
  return "border-red-500 bg-red-900/15";
}

function infoChegadaKDS(pedido: Pedido): string | null {
  if (pedido.origem !== "APP" || !pedido.previsaoChegada) return null;
  const chegada    = new Date(pedido.previsaoChegada);
  const minFaltam  = Math.round((chegada.getTime() - Date.now()) / 60_000);
  const horaFmt    = chegada.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (minFaltam < 0)  return `⚠ Devia chegar às ${horaFmt} (${Math.abs(minFaltam)}min atrás)`;
  if (minFaltam === 0) return `Cliente chegando agora!`;
  return `Chega às ${horaFmt} (${minFaltam}min)`;
}

export default function KDS() {
  const { data: session } = useSession();
  const empresaId = (session?.user as { empresaId?: string })?.empresaId ?? "";
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [tick, setTick] = useState(0);
  const [caixaFechado, setCaixaFechado] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/caixa/status")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCaixaFechado(!d.data.aberto); })
      .catch(() => {});
  }, []);

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
      <div className="px-8 py-4 border-b border-white/10 flex items-center justify-between"
           style={{ background: "#3B2415" }}>
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "#F6F0E5" }}>KDS — Barista</h1>
          <p className="text-sm" style={{ color: "rgba(246,240,229,0.6)" }}>
            {pedidos.length} pedido(s) em aberto
          </p>
        </div>
        <div className="flex items-center gap-4">
          {caixaFechado && (
            <a
              href="/caixa"
              className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/40
                         text-amber-300 text-sm font-medium px-4 py-2 rounded-xl hover:bg-amber-500/30 transition-all"
            >
              ⚠️ Caixa não aberto — Abrir Caixa
            </a>
          )}
          <div className="text-sm font-mono" style={{ color: "#C8853A" }}>
            {new Date().toLocaleTimeString("pt-BR")}
          </div>
        </div>
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
                {/* Badges pedido online */}
                {pedido.origem === "APP" && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                      📱 Online
                    </span>
                    {pedido.pago && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                        ✓ Pago
                      </span>
                    )}
                  </div>
                )}

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

                {/* Previsão de chegada (pedidos online) */}
                {infoChegadaKDS(pedido) && (
                  <div className={`text-xs font-medium px-2.5 py-1.5 rounded-lg ${
                    (new Date(pedido.previsaoChegada!).getTime() - Date.now()) < 0
                      ? "bg-red-500/20 text-red-300"
                      : (new Date(pedido.previsaoChegada!).getTime() - Date.now()) < 15 * 60_000
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-zinc-700 text-zinc-300"
                  }`}>
                    🕐 {infoChegadaKDS(pedido)}
                  </div>
                )}

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
                      className="flex-1 font-extrabold py-3 rounded-xl transition-opacity hover:opacity-90 text-lg"
                      style={{ background: "#C8853A", color: "#3B2415" }}
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
                  <button
                    onClick={() =>
                      imprimirComanda({
                        senha: pedido.senha,
                        itens: pedido.itens.map((item) => ({
                          nome: item.produto.nome,
                          quantidade: item.quantidade,
                          adicionais: item.adicionais.map((a) => a.adicional.nome),
                          observacao: item.observacao ?? undefined,
                        })),
                        total: 0,
                        via: "BARISTA",
                      })
                    }
                    className="px-3 py-3 rounded-xl border border-white/20 text-zinc-300
                               hover:bg-white/10 transition-colors text-lg"
                    title="Reimprimir comanda"
                  >
                    🖨️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
