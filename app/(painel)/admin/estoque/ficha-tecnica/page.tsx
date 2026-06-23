"use client";

import { useEffect, useState } from "react";

interface Produto { id: string; nome: string }
interface Insumo  { id: string; nome: string; unidade: string }
interface FichaItem {
  id: string; insumoId: string; quantidade: number;
  insumo: { id: string; nome: string; unidade: string };
}

export default function FichaTecnicaPage() {
  const [produtos,     setProdutos]     = useState<Produto[]>([]);
  const [insumos,      setInsumos]      = useState<Insumo[]>([]);
  const [produtoId,    setProdutoId]    = useState("");
  const [ficha,        setFicha]        = useState<FichaItem[]>([]);
  const [novoInsumoId, setNovoInsumoId] = useState("");
  const [novaQtd,      setNovaQtd]      = useState("");
  const [carregando,   setCarregando]   = useState(false);
  const [msg,          setMsg]          = useState<{ texto: string; ok: boolean } | null>(null);

  function feedback(texto: string, ok: boolean) {
    setMsg({ texto, ok }); setTimeout(function () { setMsg(null); }, 3000);
  }

  useEffect(function () {
    const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";
    Promise.all([
      fetch(`/api/produtos?empresaId=${EMPRESA_ID}`).then(function (r) { return r.json(); }),
      fetch("/api/admin/estoque/insumos").then(function (r) { return r.json(); }),
    ]).then(function ([p, i]) {
      if (p.ok) setProdutos(p.data);
      if (i.ok) setInsumos(i.data);
    });
  }, []);

  useEffect(function () {
    if (!produtoId) { setFicha([]); return; }
    setCarregando(true);
    fetch(`/api/admin/estoque/ficha-tecnica/${produtoId}`)
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok) setFicha(d.data); })
      .finally(function () { setCarregando(false); });
  }, [produtoId]);

  async function adicionarItem() {
    if (!novoInsumoId || !novaQtd || !produtoId) return;
    var r = await fetch(`/api/admin/estoque/ficha-tecnica/${produtoId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insumoId: novoInsumoId, quantidade: Number(novaQtd) }),
    });
    var d = await r.json();
    if (d.ok || d.data) {
      feedback("Item adicionado!", true);
      setNovoInsumoId(""); setNovaQtd("");
      var upd = await fetch(`/api/admin/estoque/ficha-tecnica/${produtoId}`).then(function (r) { return r.json(); });
      if (upd.ok) setFicha(upd.data);
    } else feedback(d.error ?? "Erro", false);
  }

  async function removerItem(insumoId: string) {
    if (!confirm("Remover este insumo da ficha?")) return;
    var r = await fetch(`/api/admin/estoque/ficha-tecnica/${produtoId}?insumoId=${insumoId}`, { method: "DELETE" });
    var d = await r.json();
    if (d.ok) {
      feedback("Removido!", true);
      setFicha(function (f) { return f.filter(function (i) { return i.insumoId !== insumoId; }); });
    } else feedback(d.error ?? "Erro", false);
  }

  // Insumos que ainda não estão na ficha
  var insumosDisponiveis = insumos.filter(function (i) {
    return !ficha.some(function (f) { return f.insumoId === i.id; });
  });

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-cb-marrom">Ficha Técnica</h1>
        <p className="text-cb-marrom/60 text-sm mt-1">
          Define quais insumos (e quanto) são consumidos por unidade vendida de cada produto.
        </p>
      </div>

      {/* Seletor de produto */}
      <div className="bg-white rounded-2xl border border-cb-marrom/10 p-5 shadow-sm">
        <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider block mb-2">Produto</label>
        <select
          value={produtoId}
          onChange={function (e) { setProdutoId(e.target.value); }}
          className="w-full border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom bg-white focus:outline-none focus:border-cb-amber"
        >
          <option value="">Selecione um produto...</option>
          {produtos.map(function (p) { return <option key={p.id} value={p.id}>{p.nome}</option>; })}
        </select>
      </div>

      {produtoId && (
        <>
          {/* Ficha atual */}
          <div className="bg-white rounded-2xl border border-cb-marrom/10 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-cb-marrom/10">
              <p className="font-bold text-cb-marrom">Insumos da ficha</p>
            </div>
            {carregando ? (
              <div className="py-8 text-center text-cb-marrom/40">Carregando...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-cb-bege/50">
                  <tr>
                    <th className="text-left px-5 py-3 text-cb-marrom/60 font-semibold">Insumo</th>
                    <th className="text-right px-4 py-3 text-cb-marrom/60 font-semibold">Qtd / unidade vendida</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-cb-marrom/5">
                  {ficha.map(function (f) {
                    return (
                      <tr key={f.id} className="hover:bg-cb-bege/20">
                        <td className="px-5 py-3 text-cb-marrom">{f.insumo.nome}</td>
                        <td className="px-4 py-3 text-right text-cb-marrom">
                          {f.quantidade} <span className="text-cb-marrom/40 text-xs">{f.insumo.unidade}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={function () { removerItem(f.insumoId); }} className="text-xs text-red-500 hover:underline">Remover</button>
                        </td>
                      </tr>
                    );
                  })}
                  {ficha.length === 0 && (
                    <tr><td colSpan={3} className="px-5 py-6 text-center text-cb-marrom/40">Nenhum insumo na ficha.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Adicionar insumo */}
          {insumosDisponiveis.length > 0 && (
            <div className="bg-white rounded-2xl border border-cb-marrom/10 p-5 shadow-sm">
              <p className="font-bold text-cb-marrom mb-4">Adicionar insumo</p>
              <div className="flex gap-3 flex-wrap">
                <select
                  value={novoInsumoId}
                  onChange={function (e) { setNovoInsumoId(e.target.value); }}
                  className="flex-1 min-w-[200px] border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom bg-white focus:outline-none focus:border-cb-amber"
                >
                  <option value="">Selecione um insumo...</option>
                  {insumosDisponiveis.map(function (i) {
                    return <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>;
                  })}
                </select>
                <input
                  type="number" min="0" step="0.001" placeholder="Quantidade por unidade"
                  value={novaQtd}
                  onChange={function (e) { setNovaQtd(e.target.value); }}
                  className="w-48 border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom bg-white focus:outline-none focus:border-cb-amber"
                />
                <button
                  onClick={adicionarItem}
                  disabled={!novoInsumoId || !novaQtd}
                  className="bg-cb-amber text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 hover:bg-cb-amber/90 transition-colors"
                >
                  Adicionar
                </button>
              </div>
              {msg && <p className={`text-sm font-medium mt-3 ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.texto}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
