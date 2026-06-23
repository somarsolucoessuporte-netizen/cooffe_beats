"use client";

import { useEffect, useState } from "react";

interface Insumo {
  id: string; nome: string; unidade: string;
  estoqueAtual: number; estoqueMinimo: number;
  percentualPerda: number; custo: number;
  critico: boolean; atencao: boolean; ativo: boolean;
}

const VAZIO: Partial<Insumo> = { nome: "", unidade: "", estoqueAtual: 0, estoqueMinimo: 0, percentualPerda: 3, custo: 0 };

export default function InsumosPage() {
  const [insumos,   setInsumos]   = useState<Insumo[]>([]);
  const [form,      setForm]      = useState<Partial<Insumo>>(VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando,   setSalvando]   = useState(false);
  const [msg,        setMsg]        = useState<{ texto: string; ok: boolean } | null>(null);

  function feedback(texto: string, ok: boolean) {
    setMsg({ texto, ok });
    setTimeout(function () { setMsg(null); }, 4000);
  }

  async function carregar() {
    setCarregando(true);
    var r = await fetch("/api/admin/estoque/insumos");
    var d = await r.json();
    if (d.ok) setInsumos(d.data);
    setCarregando(false);
  }

  useEffect(function () { carregar(); }, []);

  async function salvar() {
    if (!form.nome?.trim() || !form.unidade?.trim()) { feedback("Nome e unidade obrigatórios", false); return; }
    setSalvando(true);
    try {
      var url    = editandoId ? `/api/admin/estoque/insumos/${editandoId}` : "/api/admin/estoque/insumos";
      var method = editandoId ? "PATCH" : "POST";
      var r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      var d = await r.json();
      if (d.ok || d.data) {
        feedback(editandoId ? "Atualizado!" : "Criado!", true);
        setForm(VAZIO); setEditandoId(null);
        carregar();
      } else { feedback(d.error ?? "Erro", false); }
    } catch { feedback("Erro de conexão", false); }
    finally { setSalvando(false); }
  }

  async function deletar(id: string) {
    if (!confirm("Desativar este insumo?")) return;
    var r = await fetch(`/api/admin/estoque/insumos/${id}`, { method: "DELETE" });
    var d = await r.json();
    if (d.ok) { feedback("Insumo desativado", true); carregar(); }
    else feedback(d.error ?? "Erro", false);
  }

  function editar(i: Insumo) {
    setEditandoId(i.id);
    setForm({ nome: i.nome, unidade: i.unidade, estoqueAtual: i.estoqueAtual, estoqueMinimo: i.estoqueMinimo, percentualPerda: i.percentualPerda, custo: i.custo });
  }

  function campo(label: string, key: keyof typeof form, tipo: "text" | "number" = "text") {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">{label}</label>
        <input
          type={tipo} step={tipo === "number" ? "0.001" : undefined}
          value={form[key] as string ?? ""}
          onChange={function (e) { setForm(function (f) { return { ...f, [key]: tipo === "number" ? Number(e.target.value) : e.target.value }; }); }}
          className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom bg-white focus:outline-none focus:border-cb-amber"
        />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-cb-marrom">Insumos</h1>

      {/* Formulário */}
      <div className="bg-white rounded-2xl border border-cb-marrom/10 p-5 shadow-sm">
        <p className="font-bold text-cb-marrom mb-4">{editandoId ? "Editar insumo" : "Novo insumo"}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {campo("Nome", "nome")}
          {campo("Unidade (kg, L, un...)", "unidade")}
          {campo("Estoque Atual", "estoqueAtual", "number")}
          {campo("Estoque Mínimo", "estoqueMinimo", "number")}
          {campo("% Perda Aceitável", "percentualPerda", "number")}
          {campo("Custo Unitário (R$)", "custo", "number")}
        </div>
        <div className="flex gap-3 mt-4">
          {editandoId && (
            <button
              onClick={function () { setForm(VAZIO); setEditandoId(null); }}
              className="border-2 border-cb-marrom/20 text-cb-marrom font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-cb-bege transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={salvar} disabled={salvando}
            className="bg-cb-amber text-white font-bold px-8 py-2.5 rounded-xl text-sm disabled:opacity-50 hover:bg-cb-amber/90 transition-colors"
          >
            {salvando ? "Salvando..." : editandoId ? "Atualizar" : "Criar Insumo"}
          </button>
          {msg && (
            <p className={`text-sm font-medium self-center ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.texto}</p>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-cb-marrom/10 shadow-sm overflow-hidden">
        {carregando ? (
          <div className="flex justify-center py-12 text-cb-marrom/40">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-cb-bege/50">
              <tr>
                <th className="text-left px-5 py-3 text-cb-marrom/60 font-semibold">Nome</th>
                <th className="text-center px-3 py-3 text-cb-marrom/60 font-semibold">Unidade</th>
                <th className="text-right px-3 py-3 text-cb-marrom/60 font-semibold">Atual</th>
                <th className="text-right px-3 py-3 text-cb-marrom/60 font-semibold">Mínimo</th>
                <th className="text-right px-3 py-3 text-cb-marrom/60 font-semibold">% Perda</th>
                <th className="text-right px-3 py-3 text-cb-marrom/60 font-semibold">Custo</th>
                <th className="text-center px-3 py-3 text-cb-marrom/60 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-cb-marrom/5">
              {insumos.map(function (i) {
                return (
                  <tr key={i.id} className="hover:bg-cb-bege/20 transition-colors">
                    <td className="px-5 py-3 font-medium text-cb-marrom">{i.nome}</td>
                    <td className="px-3 py-3 text-center text-cb-marrom/60">{i.unidade}</td>
                    <td className="px-3 py-3 text-right text-cb-marrom">{i.estoqueAtual.toFixed(3)}</td>
                    <td className="px-3 py-3 text-right text-cb-marrom/60">{i.estoqueMinimo.toFixed(3)}</td>
                    <td className="px-3 py-3 text-right text-cb-marrom/60">{i.percentualPerda}%</td>
                    <td className="px-3 py-3 text-right text-cb-amber font-medium">R$ {i.custo.toFixed(4)}</td>
                    <td className="px-3 py-3 text-center">
                      {i.critico ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Crítico</span>
                        : i.atencao ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Atenção</span>
                        : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={function () { editar(i); }} className="text-xs text-cb-amber hover:underline">Editar</button>
                        <button onClick={function () { deletar(i.id); }} className="text-xs text-red-500 hover:underline">Desativar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!carregando && insumos.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-cb-marrom/40">Nenhum insumo cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
