"use client";

import { useEffect, useState, useCallback } from "react";

type Categoria = {
  id: string;
  nome: string;
  emoji: string;
  ordem: number;
  ativo: boolean;
  _count: { produtos: number };
};
type FormData = { nome: string; emoji: string; ordem: string; ativo: boolean };

const FORM_VAZIO: FormData = { nome: "", emoji: "", ordem: "0", ativo: true };

const inputClass =
  "w-full bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-zinc-900 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200";

export default function AdminCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/admin/categorias");
    const data = await res.json();
    if (data.ok) setCategorias(data.data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirCriar = () => {
    setEditandoId(null);
    const proximaOrdem =
      categorias.length > 0 ? Math.max(...categorias.map((c) => c.ordem)) + 1 : 0;
    setForm({ ...FORM_VAZIO, ordem: String(proximaOrdem) });
    setModalAberto(true);
    setMsg(null);
  };

  const abrirEditar = (c: Categoria) => {
    setEditandoId(c.id);
    setForm({ nome: c.nome, emoji: c.emoji, ordem: String(c.ordem), ativo: c.ativo });
    setModalAberto(true);
    setMsg(null);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditandoId(null);
    setForm(FORM_VAZIO);
  };

  const salvar = async () => {
    if (!form.nome.trim()) {
      setMsg({ tipo: "erro", texto: "Nome é obrigatório." });
      return;
    }
    setSalvando(true);
    try {
      const url = editandoId
        ? `/api/admin/categorias/${editandoId}`
        : "/api/admin/categorias";
      const res = await fetch(url, {
        method: editandoId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          emoji: form.emoji.trim() || "🍽️",
          ordem: parseInt(form.ordem) || 0,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        fecharModal();
        setMsg({ tipo: "ok", texto: editandoId ? "Categoria atualizada!" : "Categoria criada!" });
        carregar();
      } else {
        setMsg({ tipo: "erro", texto: data.error ?? "Erro ao salvar." });
      }
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async (c: Categoria) => {
    await fetch(`/api/admin/categorias/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !c.ativo }),
    });
    carregar();
  };

  const moverOrdem = async (c: Categoria, direcao: -1 | 1) => {
    await fetch(`/api/admin/categorias/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordem: c.ordem + direcao }),
    });
    carregar();
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Categorias</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{categorias.length} cadastradas</p>
        </div>
        <button
          onClick={abrirCriar}
          className="bg-amber-500 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-amber-600 transition-colors text-sm shadow-sm"
        >
          + Nova Categoria
        </button>
      </div>

      {msg && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm flex items-center justify-between border ${
            msg.tipo === "ok"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {msg.texto}
          <button onClick={() => setMsg(null)} className="opacity-50 hover:opacity-100 ml-4 text-xs">
            ✕
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              {["Ordem", "Categoria", "Produtos", "Ativo", ""].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carregando
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="h-5 bg-zinc-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              : categorias.length === 0
              ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-zinc-400 text-sm">
                      Nenhuma categoria cadastrada.
                    </td>
                  </tr>
                )
              : categorias.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`border-b border-zinc-100 hover:bg-zinc-50 transition-colors ${
                      !c.ativo ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moverOrdem(c, -1)}
                          disabled={idx === 0}
                          className="text-zinc-400 hover:text-zinc-700 disabled:opacity-20 text-sm px-1"
                        >
                          ▲
                        </button>
                        <span className="text-zinc-500 text-sm w-6 text-center">{c.ordem}</span>
                        <button
                          onClick={() => moverOrdem(c, 1)}
                          disabled={idx === categorias.length - 1}
                          className="text-zinc-400 hover:text-zinc-700 disabled:opacity-20 text-sm px-1"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{c.emoji}</span>
                        <span className="text-sm font-medium text-zinc-900">{c.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-500">{c._count.produtos}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAtivo(c)}
                        className={`relative w-10 h-6 rounded-full transition-colors ${
                          c.ativo ? "bg-green-500" : "bg-zinc-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            c.ativo ? "translate-x-4" : ""
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => abrirEditar(c)}
                        className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                      >
                        ✏️
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-zinc-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">
                {editandoId ? "Editar Categoria" : "Nova Categoria"}
              </h2>
              <button
                onClick={fecharModal}
                className="text-zinc-400 hover:text-zinc-700 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {msg && (
                <div className="px-4 py-2.5 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
                  {msg.texto}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">
                  Nome *
                </label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  className={inputClass}
                  placeholder="Ex: Bebidas Quentes"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">
                    Emoji
                  </label>
                  <input
                    value={form.emoji}
                    onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                    className={`${inputClass} text-center text-xl`}
                    placeholder="☕"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">
                    Ordem
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.ordem}
                    onChange={(e) => setForm((f) => ({ ...f, ordem: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, ativo: !f.ativo }))}
                className="flex items-center gap-3"
              >
                <div
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    form.ativo ? "bg-green-500" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      form.ativo ? "translate-x-4" : ""
                    }`}
                  />
                </div>
                <span className="text-sm text-zinc-700">Ativa no cardápio</span>
              </button>
            </div>

            <div className="p-6 border-t border-zinc-200 flex gap-3 justify-end">
              <button
                onClick={fecharModal}
                className="px-5 py-2.5 text-zinc-500 hover:text-zinc-700 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="bg-amber-500 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-amber-600 transition-colors text-sm disabled:opacity-50 shadow-sm"
              >
                {salvando ? "Salvando..." : editandoId ? "Salvar" : "Criar Categoria"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
