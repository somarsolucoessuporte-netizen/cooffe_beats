"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatarMoeda } from "@/lib/utils";

interface Insumo {
  id: string; nome: string; unidade: string;
  estoqueAtual: number; estoqueMinimo: number;
  critico: boolean; atencao: boolean;
}
interface Resumo { total: number; alertas: number; ultimoInventario: string | null }

function BarraEstoque({ atual, minimo }: { atual: number; minimo: number }) {
  // Referência: mínimo * 3 = barra cheia
  var ref   = Math.max(minimo * 3, atual, 1);
  var perc  = Math.min(100, (atual / ref) * 100);
  var cor   = atual < minimo ? "bg-red-500" : atual < minimo * 1.2 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="w-full bg-cb-marrom/10 rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${cor}`} style={{ width: `${perc}%` }} />
    </div>
  );
}

export default function EstoqueDashboard() {
  const [insumos,   setInsumos]   = useState<Insumo[]>([]);
  const [resumo,    setResumo]    = useState<Resumo>({ total: 0, alertas: 0, ultimoInventario: null });
  const [carregando, setCarregando] = useState(true);

  // Modal de entrada rápida
  const [modalEntrada, setModalEntrada] = useState(false);
  const [entradaForm, setEntradaForm]   = useState({ insumoId: "", quantidade: "", observacao: "" });
  const [salvando, setSalvando]         = useState(false);
  const [msg, setMsg]                   = useState("");

  useEffect(function () {
    Promise.all([
      fetch("/api/admin/estoque/insumos").then(function (r) { return r.json(); }),
      fetch("/api/admin/estoque/inventario").then(function (r) { return r.json(); }),
    ]).then(function ([ins, inv]) {
      if (ins.ok) {
        setInsumos(ins.data);
        setResumo({
          total:    ins.data.length,
          alertas:  ins.data.filter(function (i: Insumo) { return i.critico; }).length,
          ultimoInventario: inv.ok && inv.data.length > 0
            ? new Date(inv.data[0].createdAt).toLocaleDateString("pt-BR")
            : null,
        });
      }
    }).finally(function () { setCarregando(false); });
  }, []);

  async function registrarEntrada() {
    if (!entradaForm.insumoId || !entradaForm.quantidade) return;
    setSalvando(true);
    try {
      var r = await fetch("/api/admin/estoque/movimentacoes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insumoId:   entradaForm.insumoId,
          tipo:       "ENTRADA",
          quantidade: Number(entradaForm.quantidade),
          origem:     "MANUAL",
          observacao: entradaForm.observacao || undefined,
        }),
      });
      var d = await r.json();
      if (d.ok) {
        setMsg("Entrada registrada!");
        setModalEntrada(false);
        setEntradaForm({ insumoId: "", quantidade: "", observacao: "" });
        // Recarrega
        var ins = await fetch("/api/admin/estoque/insumos").then(function (r) { return r.json(); });
        if (ins.ok) setInsumos(ins.data);
      } else setMsg(d.error ?? "Erro");
    } catch { setMsg("Erro de conexão"); }
    finally { setSalvando(false); setTimeout(function () { setMsg(""); }, 3000); }
  }

  if (carregando) return <div className="flex items-center justify-center h-64 text-cb-marrom/50">Carregando...</div>;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cb-marrom">Estoque</h1>
          <p className="text-cb-marrom/60 text-sm mt-1">Visão geral dos insumos e movimentações.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={function () { setModalEntrada(true); }}
            className="bg-cb-amber text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-cb-amber/90 transition-colors"
          >
            + Entrada de estoque
          </button>
          <Link href="/admin/estoque/nfe"
            className="border-2 border-cb-marrom/20 text-cb-marrom font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-cb-bege transition-colors">
            🧾 Importar NF-e
          </Link>
          <Link href="/admin/estoque/inventario"
            className="border-2 border-cb-marrom/20 text-cb-marrom font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-cb-bege transition-colors">
            🔢 Inventário
          </Link>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-cb-marrom/10 p-5 shadow-sm">
          <p className="text-cb-marrom/50 text-sm">Insumos cadastrados</p>
          <p className="text-3xl font-extrabold text-cb-marrom mt-1">{resumo.total}</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${resumo.alertas > 0 ? "bg-red-50 border-red-200" : "bg-white border-cb-marrom/10"}`}>
          <p className={`text-sm ${resumo.alertas > 0 ? "text-red-600" : "text-cb-marrom/50"}`}>Insumos em alerta</p>
          <p className={`text-3xl font-extrabold mt-1 ${resumo.alertas > 0 ? "text-red-600" : "text-cb-marrom"}`}>{resumo.alertas}</p>
        </div>
        <div className="bg-white rounded-2xl border border-cb-marrom/10 p-5 shadow-sm">
          <p className="text-cb-marrom/50 text-sm">Último inventário</p>
          <p className="text-xl font-extrabold text-cb-marrom mt-1">{resumo.ultimoInventario ?? "Nunca"}</p>
        </div>
      </div>

      {/* Tabela de insumos */}
      <div className="bg-white rounded-2xl border border-cb-marrom/10 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-cb-marrom/10 flex items-center justify-between">
          <p className="font-bold text-cb-marrom">Insumos</p>
          <Link href="/admin/estoque/insumos" className="text-cb-amber text-sm hover:underline">
            Gerenciar →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cb-bege/50">
              <tr>
                <th className="text-left px-5 py-3 text-cb-marrom/60 font-semibold">Insumo</th>
                <th className="text-right px-4 py-3 text-cb-marrom/60 font-semibold">Atual</th>
                <th className="text-right px-4 py-3 text-cb-marrom/60 font-semibold">Mínimo</th>
                <th className="px-4 py-3 text-cb-marrom/60 font-semibold w-36">Nível</th>
                <th className="text-center px-4 py-3 text-cb-marrom/60 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cb-marrom/5">
              {insumos.map(function (i) {
                return (
                  <tr key={i.id} className="hover:bg-cb-bege/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-cb-marrom">{i.nome}</td>
                    <td className="px-4 py-3 text-right text-cb-marrom">
                      {i.estoqueAtual.toFixed(3)} <span className="text-cb-marrom/40 text-xs">{i.unidade}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-cb-marrom/60">
                      {i.estoqueMinimo.toFixed(3)} <span className="text-cb-marrom/40 text-xs">{i.unidade}</span>
                    </td>
                    <td className="px-4 py-3">
                      <BarraEstoque atual={i.estoqueAtual} minimo={i.estoqueMinimo} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {i.critico ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Crítico</span>
                      ) : i.atencao ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Atenção</span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {insumos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-cb-marrom/40">
                    Nenhum insumo cadastrado. <Link href="/admin/estoque/insumos" className="text-cb-amber hover:underline">Cadastrar agora →</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {msg && <p className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">{msg}</p>}

      {/* Modal entrada rápida */}
      {modalEntrada && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-7 w-full max-w-sm mx-4 shadow-2xl flex flex-col gap-4">
            <p className="font-extrabold text-cb-marrom text-lg">Registrar Entrada</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Insumo</label>
              <select
                value={entradaForm.insumoId}
                onChange={function (e) { setEntradaForm(function (f) { return { ...f, insumoId: e.target.value }; }); }}
                className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom bg-white focus:outline-none focus:border-cb-amber"
              >
                <option value="">Selecione...</option>
                {insumos.map(function (i) {
                  return <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>;
                })}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Quantidade</label>
              <input
                type="number" min="0" step="0.001"
                value={entradaForm.quantidade}
                onChange={function (e) { setEntradaForm(function (f) { return { ...f, quantidade: e.target.value }; }); }}
                className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom bg-white focus:outline-none focus:border-cb-amber"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Observação (opcional)</label>
              <input
                type="text"
                value={entradaForm.observacao}
                onChange={function (e) { setEntradaForm(function (f) { return { ...f, observacao: e.target.value }; }); }}
                className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom bg-white focus:outline-none focus:border-cb-amber"
                placeholder="Compra de fornecedor..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={function () { setModalEntrada(false); }}
                className="flex-1 border-2 border-cb-marrom/20 text-cb-marrom font-bold py-2.5 rounded-2xl text-sm hover:bg-cb-bege transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={registrarEntrada}
                disabled={salvando || !entradaForm.insumoId || !entradaForm.quantidade}
                className="flex-1 bg-cb-amber text-white font-bold py-2.5 rounded-2xl text-sm disabled:opacity-50 hover:bg-cb-amber/90 transition-colors"
              >
                {salvando ? "..." : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
