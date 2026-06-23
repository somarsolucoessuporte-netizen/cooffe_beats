"use client";

import { useEffect, useState } from "react";

interface InventarioItem {
  id: string; insumoId: string;
  estoqueTeorico: number; estoqueReal: number;
  variacao: number; variacaoPerc: number; dentro: boolean;
  insumo: { nome: string; unidade: string; percentualPerda: number };
}

interface Inventario {
  id: string; status: string; createdAt: string;
  finalizadoEm: string | null; criadoPor: string | null;
  itens: InventarioItem[];
  _count?: { itens: number };
}

export default function InventarioPage() {
  const [inventarios, setInventarios] = useState<Inventario[]>([]);
  const [ativo,       setAtivo]       = useState<Inventario | null>(null);
  const [reais,       setReais]       = useState<Record<string, string>>({});
  const [carregando,  setCarregando]  = useState(true);
  const [iniciando,   setIniciando]   = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [msg,         setMsg]         = useState<{ texto: string; ok: boolean } | null>(null);
  const [obsNovo,     setObsNovo]     = useState("");

  function feedback(texto: string, ok: boolean) {
    setMsg({ texto, ok }); setTimeout(function () { setMsg(null); }, 5000);
  }

  async function carregar() {
    setCarregando(true);
    var r  = await fetch("/api/admin/estoque/inventario");
    var d  = await r.json();
    if (d.ok) {
      setInventarios(d.data);
      // Verifica se há um aberto
      var aberto = d.data.find(function (i: Inventario) { return i.status === "ABERTO"; });
      if (aberto) {
        var r2 = await fetch(`/api/admin/estoque/inventario/${aberto.id}`);
        var d2 = await r2.json();
        if (d2.ok) {
          setAtivo(d2.data);
          // Inicializa os valores reais com zeros
          var mapa: Record<string, string> = {};
          for (var item of d2.data.itens) mapa[item.id] = item.estoqueReal.toString();
          setReais(mapa);
        }
      }
    }
    setCarregando(false);
  }

  useEffect(function () { carregar(); }, []);

  async function iniciarInventario() {
    if (!confirm("Iniciar um novo inventário? Isso captura o estoque teórico atual de todos os insumos.")) return;
    setIniciando(true);
    var r = await fetch("/api/admin/estoque/inventario", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observacao: obsNovo || undefined }),
    });
    var d = await r.json();
    if (d.ok || d.data) { feedback("Inventário iniciado!", true); setObsNovo(""); carregar(); }
    else feedback(d.error ?? "Erro", false);
    setIniciando(false);
  }

  async function finalizar() {
    if (!ativo) return;
    if (!confirm("Finalizar inventário? O estoque será atualizado com os valores reais informados.")) return;
    setFinalizando(true);
    var itens = ativo.itens.map(function (i) {
      return { id: i.id, estoqueReal: parseFloat(reais[i.id] ?? "0") || 0 };
    });
    var r = await fetch(`/api/admin/estoque/inventario/${ativo.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens }),
    });
    var d = await r.json();
    if (d.ok || d.data) { feedback("Inventário finalizado! Estoque atualizado.", true); setAtivo(null); carregar(); }
    else feedback(d.error ?? "Erro", false);
    setFinalizando(false);
  }

  function variacaoCor(perc: number, dentro: boolean): string {
    if (!dentro) return "text-red-600 font-bold";
    if (perc < 0) return "text-amber-600";
    if (perc > 0) return "text-green-600";
    return "text-cb-marrom/60";
  }

  if (carregando) return <div className="flex items-center justify-center h-64 text-cb-marrom/50">Carregando...</div>;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cb-marrom">Inventário de Estoque</h1>
          <p className="text-cb-marrom/60 text-sm mt-1">Compare estoque teórico com a contagem física.</p>
        </div>
        {!ativo && (
          <div className="flex gap-2 items-end">
            <input
              type="text" placeholder="Observação (opcional)"
              value={obsNovo}
              onChange={function (e) { setObsNovo(e.target.value); }}
              className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom bg-white focus:outline-none focus:border-cb-amber w-48"
            />
            <button
              onClick={iniciarInventario} disabled={iniciando}
              className="bg-cb-amber text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 hover:bg-cb-amber/90 transition-colors whitespace-nowrap"
            >
              {iniciando ? "Iniciando..." : "Novo Inventário"}
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
          {msg.texto}
        </div>
      )}

      {/* Inventário ativo */}
      {ativo && (
        <div className="bg-white rounded-2xl border-2 border-cb-amber/30 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-cb-marrom/10 flex items-center justify-between bg-cb-amber/5">
            <div>
              <p className="font-extrabold text-cb-marrom">Inventário em andamento</p>
              <p className="text-cb-marrom/50 text-xs mt-0.5">Preencha os valores reais contados fisicamente</p>
            </div>
            <button
              onClick={finalizar} disabled={finalizando}
              className="bg-cb-marrom text-cb-bege font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 hover:bg-cb-marrom/90 transition-colors"
            >
              {finalizando ? "Finalizando..." : "Finalizar Inventário"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cb-bege/50">
                <tr>
                  <th className="text-left px-5 py-3 text-cb-marrom/60 font-semibold">Insumo</th>
                  <th className="text-center px-3 py-3 text-cb-marrom/60 font-semibold">Un.</th>
                  <th className="text-right px-3 py-3 text-cb-marrom/60 font-semibold">Teórico</th>
                  <th className="text-center px-3 py-3 text-cb-marrom/60 font-semibold">Real (contar)</th>
                  <th className="text-right px-3 py-3 text-cb-marrom/60 font-semibold">Variação</th>
                  <th className="text-center px-3 py-3 text-cb-marrom/60 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cb-marrom/5">
                {ativo.itens.map(function (item) {
                  var real      = parseFloat(reais[item.id] ?? "0") || 0;
                  var variacao  = real - item.estoqueTeorico;
                  var percLocal = item.estoqueTeorico > 0 ? (variacao / item.estoqueTeorico) * 100 : 0;
                  var dentroLocal = Math.abs(percLocal) <= item.insumo.percentualPerda;
                  return (
                    <tr key={item.id} className="hover:bg-cb-bege/20 transition-colors">
                      <td className="px-5 py-2.5 font-medium text-cb-marrom">{item.insumo.nome}</td>
                      <td className="px-3 py-2.5 text-center text-cb-marrom/60 text-xs">{item.insumo.unidade}</td>
                      <td className="px-3 py-2.5 text-right text-cb-marrom/70">{item.estoqueTeorico.toFixed(3)}</td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number" min="0" step="0.001"
                          value={reais[item.id] ?? "0"}
                          onChange={function (e) {
                            var v = e.target.value;
                            setReais(function (r) { return { ...r, [item.id]: v }; });
                          }}
                          className="w-28 border border-cb-marrom/20 rounded-lg px-2 py-1.5 text-sm text-cb-marrom bg-white focus:outline-none focus:border-cb-amber text-right mx-auto block"
                        />
                      </td>
                      <td className={`px-3 py-2.5 text-right ${variacaoCor(percLocal, dentroLocal)}`}>
                        {variacao > 0 ? "+" : ""}{variacao.toFixed(3)}
                        <span className="text-xs ml-1">({percLocal > 0 ? "+" : ""}{percLocal.toFixed(1)}%)</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {dentroLocal
                          ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Dentro</span>
                          : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">⚠ Fora</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Histórico */}
      <div className="bg-white rounded-2xl border border-cb-marrom/10 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-cb-marrom/10">
          <p className="font-bold text-cb-marrom">Histórico de inventários</p>
        </div>
        {inventarios.filter(function (i) { return i.status === "FINALIZADO"; }).length === 0 ? (
          <div className="py-8 text-center text-cb-marrom/40 text-sm">Nenhum inventário finalizado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-cb-bege/50">
              <tr>
                <th className="text-left px-5 py-3 text-cb-marrom/60 font-semibold">Data</th>
                <th className="text-center px-3 py-3 text-cb-marrom/60 font-semibold">Insumos</th>
                <th className="text-left px-3 py-3 text-cb-marrom/60 font-semibold">Criado por</th>
                <th className="text-center px-3 py-3 text-cb-marrom/60 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cb-marrom/5">
              {inventarios.filter(function (i) { return i.status === "FINALIZADO"; }).map(function (inv) {
                return (
                  <tr key={inv.id} className="hover:bg-cb-bege/20">
                    <td className="px-5 py-3 text-cb-marrom">
                      {new Date(inv.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-3 text-center text-cb-marrom/60">{inv._count?.itens ?? "—"}</td>
                    <td className="px-3 py-3 text-cb-marrom/60">{inv.criadoPor ?? "—"}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Finalizado</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
