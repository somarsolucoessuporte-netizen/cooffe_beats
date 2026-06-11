"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { calcularTempoDecorrido, formatarMoeda } from "@/lib/utils";

interface ItemPedido {
  id: string;
  quantidade: number;
  produto: { nome: string };
  adicionais: Array<{ adicional: { nome: string } }>;
}

interface Pedido {
  id: string;
  senha: string;
  status: string;
  total: string;
  criadoEm: string;
  itens: ItemPedido[];
}

type StatusColuna = "RECEBIDO" | "EM_PREPARO" | "PRONTO" | "ENTREGUE";

const colunas: { status: StatusColuna; label: string; cor: string }[] = [
  { status: "RECEBIDO", label: "Recebidos", cor: "border-blue-500 bg-blue-500/5" },
  { status: "EM_PREPARO", label: "Em Preparo", cor: "border-yellow-500 bg-yellow-500/5" },
  { status: "PRONTO", label: "Prontos", cor: "border-green-500 bg-green-500/5" },
  { status: "ENTREGUE", label: "Entregues", cor: "border-zinc-600 bg-zinc-800/50" },
];

const proximoStatus: Record<string, StatusColuna | null> = {
  RECEBIDO: "EM_PREPARO",
  EM_PREPARO: "PRONTO",
  PRONTO: "ENTREGUE",
  ENTREGUE: null,
};

export default function Pedidos() {
  const { data: session } = useSession();
  const empresaId = (session?.user as { empresaId?: string })?.empresaId ?? "";

  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const buscarPedidos = useCallback(async () => {
    if (!empresaId) return;
    const res = await fetch(`/api/pedidos?empresaId=${empresaId}`);
    const dados = await res.json();
    if (dados.ok) setPedidos(dados.data);
  }, [empresaId]);

  useEffect(() => {
    buscarPedidos();
  }, [buscarPedidos]);

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
        setPedidos((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status } : p))
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresaId]);

  const avancarStatus = useCallback(async (pedidoId: string, statusAtual: string) => {
    const proximo = proximoStatus[statusAtual];
    if (!proximo) return;

    await fetch(`/api/pedidos/${pedidoId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: proximo }),
    });
  }, []);

  const pedidosDaColuna = (status: string) =>
    pedidos.filter((p) => p.status === status);

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold text-zinc-100">Pedidos</h1>
        <p className="text-zinc-400 text-sm mt-1">Atualização em tempo real via Supabase Realtime</p>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-5 h-full min-w-max">
          {colunas.map((col) => (
            <div
              key={col.status}
              className={`flex flex-col w-72 rounded-2xl border-2 ${col.cor} overflow-hidden`}
            >
              {/* Header coluna */}
              <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
                <span className="font-semibold text-zinc-200">{col.label}</span>
                <span className="bg-zinc-800 text-zinc-300 text-sm font-mono px-3 py-0.5 rounded-full">
                  {pedidosDaColuna(col.status).length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                {pedidosDaColuna(col.status).map((pedido) => (
                  <div
                    key={pedido.id}
                    className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-mono font-bold text-cb-amber text-lg">{pedido.senha}</span>
                      <span className="text-xs text-zinc-500">{calcularTempoDecorrido(pedido.criadoEm)}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      {pedido.itens.slice(0, 3).map((item) => (
                        <p key={item.id} className="text-sm text-zinc-300">
                          {item.quantidade}x {item.produto.nome}
                        </p>
                      ))}
                      {pedido.itens.length > 3 && (
                        <p className="text-xs text-zinc-500">+{pedido.itens.length - 3} itens</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-cb-gold font-semibold">{formatarMoeda(pedido.total)}</span>
                      {proximoStatus[pedido.status] && (
                        <button
                          onClick={() => avancarStatus(pedido.id, pedido.status)}
                          className="text-xs bg-cb-amber text-cb-espresso font-bold px-3 py-1.5 rounded-full"
                        >
                          Avançar →
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {pedidosDaColuna(col.status).length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-8">
                    <p className="text-zinc-600 text-sm text-center">Nenhum pedido</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
