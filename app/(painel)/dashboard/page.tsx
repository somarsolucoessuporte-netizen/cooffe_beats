"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatarMoeda } from "@/lib/utils";

interface MetricasDia {
  totalPedidos: number;
  faturamento: number;
  ticketMedio: number;
  produtoMaisVendido: { nome: string; quantidade: number } | null;
  horaPico: string | null;
  pedidosPorHora: Array<{ hora: string; pedidos: number }>;
}

type FiltroData = "hoje" | "ontem" | "7dias";

export default function Dashboard() {
  const { data: session } = useSession();
  const empresaId = (session?.user as { empresaId?: string })?.empresaId ?? "";
  const [metricas, setMetricas] = useState<MetricasDia | null>(null);
  const [filtro, setFiltro] = useState<FiltroData>("hoje");
  const [carregando, setCarregando] = useState(true);

  const buscarMetricas = useCallback(async () => {
    if (!empresaId) return;
    setCarregando(true);
    try {
      const res = await fetch(`/api/pedidos?empresaId=${empresaId}`);
      const dados = await res.json();
      if (!dados.ok) return;

      const todos = dados.data as Array<{
        criadoEm: string;
        total: string;
        status: string;
        itens: Array<{ produto: { nome: string }; quantidade: number }>;
      }>;

      const agora = new Date();
      const filtrado = todos.filter((p) => {
        const d = new Date(p.criadoEm);
        if (filtro === "hoje") return d.toDateString() === agora.toDateString();
        if (filtro === "ontem") {
          const ontem = new Date(agora);
          ontem.setDate(agora.getDate() - 1);
          return d.toDateString() === ontem.toDateString();
        }
        const semana = new Date(agora);
        semana.setDate(agora.getDate() - 7);
        return d >= semana;
      });

      const aprovados = filtrado.filter((p) => p.status !== "CANCELADO");
      const faturamento = aprovados.reduce((s, p) => s + parseFloat(p.total), 0);
      const ticketMedio = aprovados.length > 0 ? faturamento / aprovados.length : 0;

      // Produto mais vendido
      const contagem: Record<string, number> = {};
      aprovados.forEach((p) => {
        p.itens.forEach((i) => {
          contagem[i.produto.nome] = (contagem[i.produto.nome] ?? 0) + i.quantidade;
        });
      });
      const produtoMaisVendido = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0];

      // Pedidos por hora
      const porHora: Record<string, number> = {};
      aprovados.forEach((p) => {
        const h = new Date(p.criadoEm).getHours();
        const label = `${String(h).padStart(2, "0")}h`;
        porHora[label] = (porHora[label] ?? 0) + 1;
      });
      const pedidosPorHora = Object.entries(porHora)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([hora, pedidos]) => ({ hora, pedidos }));

      const horaPico = pedidosPorHora.sort((a, b) => b.pedidos - a.pedidos)[0]?.hora ?? null;

      setMetricas({
        totalPedidos: aprovados.length,
        faturamento,
        ticketMedio,
        produtoMaisVendido: produtoMaisVendido
          ? { nome: produtoMaisVendido[0], quantidade: produtoMaisVendido[1] }
          : null,
        horaPico,
        pedidosPorHora: pedidosPorHora.sort((a, b) => a.hora.localeCompare(b.hora)),
      });
    } finally {
      setCarregando(false);
    }
  }, [empresaId, filtro]);

  useEffect(() => {
    buscarMetricas();
  }, [buscarMetricas]);

  const cards = metricas
    ? [
        { label: "Pedidos", valor: metricas.totalPedidos.toString(), icone: "📋" },
        { label: "Faturamento", valor: formatarMoeda(metricas.faturamento), icone: "💰" },
        { label: "Ticket Médio", valor: formatarMoeda(metricas.ticketMedio), icone: "🎯" },
        {
          label: "Mais Vendido",
          valor: metricas.produtoMaisVendido
            ? `${metricas.produtoMaisVendido.nome} (${metricas.produtoMaisVendido.quantidade}x)`
            : "—",
          icone: "⭐",
        },
        { label: "Hora de Pico", valor: metricas.horaPico ?? "—", icone: "🔥" },
      ]
    : [];

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-6 border-b border-zinc-800 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>

        <div className="flex gap-2">
          {(["hoje", "ontem", "7dias"] as FiltroData[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filtro === f
                  ? "bg-cb-amber text-cb-espresso"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {f === "hoje" ? "Hoje" : f === "ontem" ? "Ontem" : "7 dias"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
        {carregando ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-zinc-900 rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Cards de métricas */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              {cards.map((card) => (
                <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <div className="text-3xl mb-2">{card.icone}</div>
                  <p className="text-zinc-400 text-sm">{card.label}</p>
                  <p className="text-zinc-100 font-bold text-lg mt-1 truncate">{card.valor}</p>
                </div>
              ))}
            </div>

            {/* Gráfico */}
            {metricas && metricas.pedidosPorHora.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-zinc-200 font-semibold mb-6">Pedidos por Hora</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={metricas.pedidosPorHora}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="hora" stroke="#71717a" tick={{ fill: "#a1a1aa" }} />
                    <YAxis stroke="#71717a" tick={{ fill: "#a1a1aa" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px" }}
                      labelStyle={{ color: "#e5a84e" }}
                      itemStyle={{ color: "#f5edd6" }}
                    />
                    <Bar dataKey="pedidos" fill="#C8853A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
