"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Agendamento {
  id:          string;
  nomeCliente: string;
  telefone:    string;
  data:        string;
  duracao:     number;
  pessoas:     number;
  observacao:  string | null;
  status:      string;
  criadoEm:    string;
  mesa:        { numero: number; nome: string | null } | null;
}

const STATUS_INFO: Record<string, { label: string; cor: string }> = {
  PENDENTE:   { label: "Pendente",   cor: "bg-yellow-100 text-yellow-700" },
  CONFIRMADO: { label: "Confirmado", cor: "bg-green-100 text-green-700" },
  CANCELADO:  { label: "Cancelado",  cor: "bg-red-100 text-red-600" },
  CONCLUIDO:  { label: "Concluído",  cor: "bg-gray-100 text-gray-500" },
};

function formatarData(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarTel(t: string) {
  const n = t.replace(/\D/g, "");
  if (n.length >= 13) return `+${n.slice(0,2)} (${n.slice(2,4)}) ${n.slice(4,9)}-${n.slice(9,13)}`;
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  return t;
}

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

export default function AgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando]     = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("PENDENTE");
  const [filtroData, setFiltroData]     = useState("");

  async function carregar() {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (filtroStatus !== "TODOS") params.set("status", filtroStatus);
      if (filtroData)               params.set("data", filtroData);
      const r = await fetch("/api/admin/agendamentos?" + params.toString());
      const d = await r.json();
      if (d.ok) setAgendamentos(d.data);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(function() { carregar(); }, [filtroStatus, filtroData]);

  useEffect(function() {
    const channel = supabase
      .channel("agendamentos-admin-" + EMPRESA_ID)
      .on("broadcast", { event: "agendamento:novo" }, carregar)
      .subscribe();
    return function() { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function alterarStatus(id: string, status: string) {
    await fetch("/api/admin/agendamentos", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id, status }),
    });
    carregar();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#3B2415]">Agendamentos</h1>
        <p className="text-sm text-[#3B2415]/60 mt-0.5">Reservas de mesa e pedidos futuros</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          {["PENDENTE", "CONFIRMADO", "TODOS"].map(function(s) {
            return (
              <button
                key={s}
                onClick={function() { setFiltroStatus(s); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filtroStatus === s
                    ? "bg-[#C8853A] text-white"
                    : "bg-white border border-gray-200 text-[#3B2415]/60 hover:border-gray-300"
                }`}
              >
                {s === "TODOS" ? "Todos" : STATUS_INFO[s]?.label ?? s}
              </button>
            );
          })}
        </div>
        <input
          type="date"
          value={filtroData}
          onChange={function(e) { setFiltroData(e.target.value); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C8853A]"
        />
        {filtroData && (
          <button
            onClick={function() { setFiltroData(""); }}
            className="text-sm text-[#3B2415]/50 hover:text-[#3B2415]"
          >
            ✕ Data
          </button>
        )}
      </div>

      {carregando ? (
        <div className="text-center py-12 text-[#3B2415]/40">Carregando...</div>
      ) : agendamentos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-[#3B2415]/50">Nenhum agendamento encontrado</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {agendamentos.map(function(ag) {
            const info = STATUS_INFO[ag.status] ?? STATUS_INFO.PENDENTE;
            return (
              <div
                key={ag.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"
              >
                <div className="flex items-start gap-4 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#3B2415] text-base">{ag.nomeCliente}</span>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${info.cor}`}>
                        {info.label}
                      </span>
                    </div>
                    <p className="text-sm text-[#3B2415]/50 mt-1">
                      📅 {formatarData(ag.data)} · 👥 {ag.pessoas} pessoa{ag.pessoas !== 1 ? "s" : ""} · ⏱ {ag.duracao}min
                    </p>
                    {ag.mesa && (
                      <p className="text-sm text-[#C8853A] font-medium mt-0.5">
                        🪑 {ag.mesa.nome ?? `Mesa ${ag.mesa.numero}`}
                      </p>
                    )}
                    {ag.observacao && (
                      <p className="text-sm text-[#3B2415]/60 mt-1 italic">"{ag.observacao}"</p>
                    )}
                    <p className="text-sm text-[#3B2415]/50 mt-1">{formatarTel(ag.telefone)}</p>
                  </div>

                  <div className="shrink-0 flex flex-col gap-2">
                    <a
                      href={`https://wa.me/${ag.telefone.replace(/\D/g, "")}?text=${encodeURIComponent("Olá " + ag.nomeCliente + "! Seu agendamento para " + new Date(ag.data).toLocaleDateString("pt-BR") + " está confirmado. ☕")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-xl text-center hover:bg-green-600"
                    >
                      📱 WhatsApp
                    </a>
                    {ag.status === "PENDENTE" && (
                      <button
                        onClick={function() { alterarStatus(ag.id, "CONFIRMADO"); }}
                        className="text-xs bg-[#C8853A] text-white px-3 py-1.5 rounded-xl hover:bg-[#b5742e]"
                      >
                        ✓ Confirmar
                      </button>
                    )}
                    {ag.status !== "CANCELADO" && ag.status !== "CONCLUIDO" && (
                      <button
                        onClick={function() { alterarStatus(ag.id, "CANCELADO"); }}
                        className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-xl hover:bg-red-50"
                      >
                        ✕ Cancelar
                      </button>
                    )}
                    {ag.status === "CONFIRMADO" && (
                      <button
                        onClick={function() { alterarStatus(ag.id, "CONCLUIDO"); }}
                        className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-xl hover:bg-gray-50"
                      >
                        Concluir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-8">Somar Soluções Digitais</p>
    </div>
  );
}
