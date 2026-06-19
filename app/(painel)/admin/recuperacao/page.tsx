"use client";

import { useEffect, useState } from "react";

interface ItemCarrinho {
  nome:       string;
  quantidade: number;
  preco:      number;
}

interface CarrinhoAbandonado {
  id:            string;
  nomeCliente:   string | null;
  telefone:      string | null;
  mesaId:        string | null;
  itensJson:     ItemCarrinho[];
  totalEstimado: number;
  recuperado:    boolean;
  criadoEm:      string;
}

function formatarMoeda(v: number) {
  return "R$ " + v.toFixed(2).replace(".", ",");
}

function formatarData(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarTelefone(t: string | null) {
  if (!t) return "—";
  const n = t.replace(/\D/g, "");
  if (n.length === 13) return `+${n.slice(0,2)} (${n.slice(2,4)}) ${n.slice(4,9)}-${n.slice(9)}`;
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  return t;
}

export default function RecuperacaoPage() {
  const [registros, setRegistros] = useState<CarrinhoAbandonado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "pendente" | "recuperado">("pendente");

  async function carregar(f: typeof filtro) {
    setCarregando(true);
    try {
      const q = f === "todos" ? "" : `?recuperado=${f === "recuperado"}`;
      const r = await fetch("/api/carrinho-abandonado" + q);
      const d = await r.json();
      if (d.ok) setRegistros(d.data);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(function() { carregar(filtro); }, [filtro]);

  async function marcarRecuperado(id: string) {
    await fetch("/api/carrinho-abandonado", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregar(filtro);
  }

  const pendentes    = registros.filter(function(r) { return !r.recuperado; });
  const totalPerdido = pendentes.reduce(function(acc, r) { return acc + Number(r.totalEstimado); }, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#3B2415]">Recuperador de Vendas</h1>
          <p className="text-sm text-[#3B2415]/60 mt-0.5">Carrinhos abandonados sem finalização</p>
        </div>
        {pendentes.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-right">
            <p className="text-xs text-red-600 font-medium">{pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}</p>
            <p className="text-base font-bold text-red-700">{formatarMoeda(totalPerdido)}</p>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {(["pendente", "todos", "recuperado"] as const).map(function(f) {
          return (
            <button
              key={f}
              onClick={function() { setFiltro(f); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filtro === f
                  ? "bg-[#C8853A] text-white"
                  : "bg-white border border-gray-200 text-[#3B2415]/60 hover:border-gray-300"
              }`}
            >
              {f === "pendente" ? "Pendentes" : f === "recuperado" ? "Recuperados" : "Todos"}
            </button>
          );
        })}
      </div>

      {carregando ? (
        <div className="text-center py-12 text-[#3B2415]/40">Carregando...</div>
      ) : registros.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-[#3B2415]/50">
            {filtro === "pendente" ? "Nenhum carrinho pendente" : "Nenhum registro encontrado"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {registros.map(function(reg) {
            const itens = reg.itensJson as unknown as ItemCarrinho[];
            return (
              <div
                key={reg.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                  reg.recuperado ? "border-green-200 opacity-60" : "border-orange-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#3B2415]">
                        {reg.nomeCliente ?? "Cliente anônimo"}
                      </span>
                      {reg.mesaId && (
                        <span className="text-xs bg-[#C8853A]/10 text-[#C8853A] px-2 py-0.5 rounded-full">
                          Mesa
                        </span>
                      )}
                      {reg.recuperado && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          ✓ Recuperado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#3B2415]/50 mt-0.5">
                      {formatarTelefone(reg.telefone)} · {formatarData(reg.criadoEm)}
                    </p>

                    {/* Itens */}
                    <div className="mt-3 flex flex-col gap-0.5">
                      {itens.map(function(item, i) {
                        return (
                          <p key={i} className="text-sm text-[#3B2415]/70">
                            {item.quantidade}x {item.nome}
                          </p>
                        );
                      })}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-extrabold text-lg text-[#3B2415]">
                      {formatarMoeda(Number(reg.totalEstimado))}
                    </p>
                    {!reg.recuperado && reg.telefone && (
                      <a
                        href={`https://wa.me/${reg.telefone.replace(/\D/g, "")}?text=${encodeURIComponent("Olá, " + (reg.nomeCliente ?? "cliente") + "! Vi que você deixou itens no carrinho. Posso ajudar? ☕")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs bg-green-500 text-white px-3 py-1.5 rounded-xl hover:bg-green-600 transition-colors"
                      >
                        📱 WhatsApp
                      </a>
                    )}
                    {!reg.recuperado && (
                      <button
                        onClick={function() { marcarRecuperado(reg.id); }}
                        className="block mt-2 w-full text-xs border border-[#C8853A] text-[#C8853A] px-3 py-1.5 rounded-xl
                                   hover:bg-[#C8853A]/10 transition-colors"
                      >
                        ✓ Marcar recuperado
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
