"use client";

import { useState } from "react";
import { formatarMoeda } from "@/lib/utils";

interface ItemDesperdicio { nome: string; unidade: string; custo: number; quantidade: number }
interface Movimentacao {
  id: string; tipo: string; quantidade: string; custo: string | null;
  origem: string; createdAt: string; observacao: string | null;
  insumo: { nome: string; unidade: string };
}
interface RelatorioCMV {
  periodo:        { inicio: string; fim: string };
  faturamento:    number;
  custoEntradas:  number;
  custoSaidas:    number;
  custoPerdas:    number;
  cmv:            number;
  cmvPerc:        number;
  topDesperdicio: ItemDesperdicio[];
  movimentacoes:  Movimentacao[];
}

function hoje(): string { return new Date().toISOString().slice(0, 10); }
function inicioMes(): string {
  var d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
}

const TIPO_COR: Record<string, string> = {
  ENTRADA: "bg-green-100 text-green-700",
  SAIDA:   "bg-blue-100 text-blue-700",
  AJUSTE:  "bg-amber-100 text-amber-700",
  PERDA:   "bg-red-100 text-red-600",
};

export default function RelatoriosEstoquePage() {
  const [dataInicio, setDataInicio] = useState(inicioMes);
  const [dataFim,    setDataFim]    = useState(hoje);
  const [dados,      setDados]      = useState<RelatorioCMV | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function buscar() {
    setCarregando(true);
    try {
      var r = await fetch(`/api/admin/estoque/relatorios/cmv?dataInicio=${dataInicio}&dataFim=${dataFim}`);
      var d = await r.json();
      if (d.ok) setDados(d.data);
    } catch { /* silencioso */ }
    finally { setCarregando(false); }
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-cb-marrom">Relatórios / CMV</h1>
        <p className="text-cb-marrom/60 text-sm mt-1">Custo da Mercadoria Vendida e análise de desperdícios.</p>
      </div>

      {/* Filtro de período */}
      <div className="bg-white rounded-2xl border border-cb-marrom/10 p-5 shadow-sm">
        <div className="flex gap-4 flex-wrap items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Data início</label>
            <input
              type="date" value={dataInicio}
              onChange={function (e) { setDataInicio(e.target.value); }}
              className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom bg-white focus:outline-none focus:border-cb-amber"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Data fim</label>
            <input
              type="date" value={dataFim}
              onChange={function (e) { setDataFim(e.target.value); }}
              className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom bg-white focus:outline-none focus:border-cb-amber"
            />
          </div>
          <button
            onClick={buscar} disabled={carregando}
            className="bg-cb-amber text-white font-bold px-8 py-2.5 rounded-xl text-sm disabled:opacity-50 hover:bg-cb-amber/90 transition-colors"
          >
            {carregando ? "Calculando..." : "Calcular CMV"}
          </button>
        </div>
      </div>

      {dados && (
        <>
          {/* Cards de CMV */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-cb-marrom/10 p-4 shadow-sm">
              <p className="text-xs text-cb-marrom/50">Faturamento</p>
              <p className="text-xl font-extrabold text-cb-marrom mt-1">{formatarMoeda(dados.faturamento)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-cb-marrom/10 p-4 shadow-sm">
              <p className="text-xs text-cb-marrom/50">Custo Entradas</p>
              <p className="text-xl font-extrabold text-green-600 mt-1">{formatarMoeda(dados.custoEntradas)}</p>
            </div>
            <div className={`rounded-2xl border p-4 shadow-sm ${dados.cmvPerc > 35 ? "bg-red-50 border-red-200" : "bg-white border-cb-marrom/10"}`}>
              <p className={`text-xs ${dados.cmvPerc > 35 ? "text-red-500" : "text-cb-marrom/50"}`}>CMV Total</p>
              <p className={`text-xl font-extrabold mt-1 ${dados.cmvPerc > 35 ? "text-red-600" : "text-cb-marrom"}`}>
                {formatarMoeda(dados.cmv)}
              </p>
            </div>
            <div className={`rounded-2xl border p-4 shadow-sm ${dados.cmvPerc > 35 ? "bg-red-50 border-red-200" : dados.cmvPerc > 28 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
              <p className="text-xs text-cb-marrom/50">% CMV / Faturamento</p>
              <p className={`text-3xl font-extrabold mt-1 ${dados.cmvPerc > 35 ? "text-red-600" : dados.cmvPerc > 28 ? "text-amber-600" : "text-green-600"}`}>
                {dados.cmvPerc.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sub-breakdown */}
            <div className="bg-white rounded-2xl border border-cb-marrom/10 p-5 shadow-sm">
              <p className="font-bold text-cb-marrom mb-3">Breakdown do CMV</p>
              <div className="flex flex-col gap-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-cb-marrom/60">Saídas por vendas</span>
                  <span className="font-bold text-blue-600">{formatarMoeda(dados.custoSaidas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cb-marrom/60">Perdas e desperdício</span>
                  <span className="font-bold text-red-500">{formatarMoeda(dados.custoPerdas)}</span>
                </div>
                <div className="border-t border-cb-marrom/10 pt-2 flex justify-between font-bold text-cb-marrom">
                  <span>CMV Total</span>
                  <span>{formatarMoeda(dados.cmv)}</span>
                </div>
              </div>
              <p className="text-xs text-cb-marrom/40 mt-4">
                Referência: CMV saudável para cafeteria = 25-32% do faturamento.
              </p>
            </div>

            {/* Top desperdício */}
            <div className="bg-white rounded-2xl border border-cb-marrom/10 p-5 shadow-sm">
              <p className="font-bold text-cb-marrom mb-3">Top 5 — Maior desperdício</p>
              {dados.topDesperdicio.length === 0 ? (
                <p className="text-cb-marrom/40 text-sm">Sem perdas no período.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {dados.topDesperdicio.map(function (item, idx) {
                    return (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-cb-marrom/30 font-bold mr-2 text-xs">#{idx + 1}</span>
                          <span className="text-cb-marrom">{item.nome}</span>
                          <span className="text-cb-marrom/40 text-xs ml-1">({item.quantidade.toFixed(3)} {item.unidade})</span>
                        </div>
                        <span className="font-bold text-red-500">{formatarMoeda(item.custo)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tabela de movimentações */}
          <div className="bg-white rounded-2xl border border-cb-marrom/10 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-cb-marrom/10 flex items-center justify-between">
              <p className="font-bold text-cb-marrom">Movimentações do período</p>
              <span className="text-xs text-cb-marrom/40">{dados.movimentacoes.length} registros</span>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-cb-bege/50 sticky top-0">
                  <tr>
                    <th className="text-left px-5 py-3 text-cb-marrom/60 font-semibold">Data</th>
                    <th className="text-left px-3 py-3 text-cb-marrom/60 font-semibold">Insumo</th>
                    <th className="text-center px-3 py-3 text-cb-marrom/60 font-semibold">Tipo</th>
                    <th className="text-right px-3 py-3 text-cb-marrom/60 font-semibold">Qtd</th>
                    <th className="text-right px-3 py-3 text-cb-marrom/60 font-semibold">Custo</th>
                    <th className="text-left px-3 py-3 text-cb-marrom/60 font-semibold">Obs.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cb-marrom/5">
                  {dados.movimentacoes.map(function (m) {
                    return (
                      <tr key={m.id} className="hover:bg-cb-bege/20">
                        <td className="px-5 py-2.5 text-cb-marrom/60 whitespace-nowrap text-xs">
                          {new Date(m.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2.5 text-cb-marrom">{m.insumo.nome}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIPO_COR[m.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                            {m.tipo}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-cb-marrom/70">
                          {parseFloat(m.quantidade).toFixed(3)} <span className="text-xs">{m.insumo.unidade}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-cb-marrom/70">
                          {m.custo != null ? formatarMoeda(Number(m.custo)) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-cb-marrom/50 text-xs max-w-[200px] truncate">
                          {m.observacao ?? m.origem}
                        </td>
                      </tr>
                    );
                  })}
                  {dados.movimentacoes.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-cb-marrom/40">Nenhuma movimentação no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
