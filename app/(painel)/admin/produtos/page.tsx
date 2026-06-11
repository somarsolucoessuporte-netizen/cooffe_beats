"use client";

import { useEffect, useState, useCallback } from "react";

type Categoria = { id: string; nome: string; emoji: string };
type Produto = {
  id: string;
  nome: string;
  descricao: string;
  preco: string;
  fotoUrl: string | null;
  destaque: boolean;
  disponivel: boolean;
  ordem: number;
  categoriaId: string;
  categoria: Categoria;
};
type FormData = {
  nome: string;
  descricao: string;
  preco: string;
  categoriaId: string;
  fotoUrl: string;
  destaque: boolean;
  disponivel: boolean;
};

const FORM_VAZIO: FormData = {
  nome: "",
  descricao: "",
  preco: "",
  categoriaId: "",
  fotoUrl: "",
  destaque: false,
  disponivel: true,
};

const moeda = (v: string | number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    typeof v === "string" ? parseFloat(v) : v
  );

export default function AdminProdutos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const carregarProdutos = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/admin/produtos");
    const data = await res.json();
    if (data.ok) setProdutos(data.data);
    setCarregando(false);
  }, []);

  const carregarCategorias = useCallback(async () => {
    const res = await fetch("/api/admin/categorias");
    const data = await res.json();
    if (data.ok) setCategorias(data.data);
  }, []);

  useEffect(() => {
    carregarProdutos();
    carregarCategorias();
  }, [carregarProdutos, carregarCategorias]);

  const abrirCriar = () => {
    setEditandoId(null);
    setForm({ ...FORM_VAZIO, categoriaId: categorias[0]?.id ?? "" });
    setModalAberto(true);
    setMsg(null);
  };

  const abrirEditar = (p: Produto) => {
    setEditandoId(p.id);
    setForm({
      nome: p.nome,
      descricao: p.descricao,
      preco: p.preco,
      categoriaId: p.categoriaId,
      fotoUrl: p.fotoUrl ?? "",
      destaque: p.destaque,
      disponivel: p.disponivel,
    });
    setModalAberto(true);
    setMsg(null);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditandoId(null);
    setForm(FORM_VAZIO);
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.preco || !form.categoriaId) {
      setMsg({ tipo: "erro", texto: "Preencha nome, preço e categoria." });
      return;
    }
    setSalvando(true);
    try {
      const url = editandoId ? `/api/admin/produtos/${editandoId}` : "/api/admin/produtos";
      const res = await fetch(url, {
        method: editandoId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          preco: parseFloat(form.preco),
          fotoUrl: form.fotoUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        fecharModal();
        setMsg({ tipo: "ok", texto: editandoId ? "Produto atualizado!" : "Produto criado!" });
        carregarProdutos();
      } else {
        setMsg({ tipo: "erro", texto: data.error ?? "Erro ao salvar." });
      }
    } finally {
      setSalvando(false);
    }
  };

  const toggleDisponivel = async (p: Produto) => {
    await fetch(`/api/admin/produtos/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disponivel: !p.disponivel }),
    });
    carregarProdutos();
  };

  const excluir = async (id: string) => {
    if (!confirm("Desativar este produto?")) return;
    await fetch(`/api/admin/produtos/${id}`, { method: "DELETE" });
    carregarProdutos();
  };

  const inputClass =
    "w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-zinc-900 text-sm focus:outline-none focus:border-[#3B2415] focus:ring-1 focus:ring-[#3B2415]/10";

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#3B2415]">Produtos</h1>
          <p className="text-[#3B2415]/60 text-sm mt-0.5">{produtos.length} cadastrados</p>
        </div>
        <button
          onClick={abrirCriar}
          className="font-bold px-5 py-2.5 rounded-xl transition-colors text-sm shadow-sm hover:opacity-90"
          style={{ background: "#3B2415", color: "#F6F0E5" }}
        >
          + Novo Produto
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
              {["Produto", "Categoria", "Preço", "Destaque", "Disponível", ""].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs font-semibold text-[#3B2415]/60 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carregando
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="h-5 bg-zinc-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              : produtos.length === 0
              ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-zinc-400 text-sm">
                      Nenhum produto cadastrado.
                    </td>
                  </tr>
                )
              : produtos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-100 overflow-hidden shrink-0">
                          {p.fotoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.fotoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg opacity-30">
                              ☕
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-900">{p.nome}</p>
                          <p className="text-xs text-zinc-400 line-clamp-1 max-w-[220px]">
                            {p.descricao}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {p.categoria.emoji} {p.categoria.nome}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-amber-600">
                      {moeda(p.preco)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.destaque ? (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          ✦ Destaque
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleDisponivel(p)}
                        className={`relative w-10 h-6 rounded-full transition-colors ${
                          p.disponivel ? "bg-green-500" : "bg-zinc-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            p.disponivel ? "translate-x-4" : ""
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => abrirEditar(p)}
                          className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => excluir(p.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Desativar"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-zinc-900">
                {editandoId ? "Editar Produto" : "Novo Produto"}
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
                  placeholder="Ex: Cappuccino Cremoso"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">
                  Descrição
                </label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  rows={2}
                  className={`${inputClass} resize-none`}
                  placeholder="Breve descrição do produto"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">
                    Preço (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.preco}
                    onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))}
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">
                    Categoria *
                  </label>
                  <select
                    value={form.categoriaId}
                    onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Selecione</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">
                  URL da Foto
                </label>
                <input
                  value={form.fotoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, fotoUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://example.com/foto.jpg"
                />
              </div>

              <div className="flex gap-6 pt-1">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, destaque: !f.destaque }))}
                  className="flex items-center gap-3"
                >
                  <div
                    className={`relative w-10 h-6 rounded-full transition-colors ${
                      form.destaque ? "bg-amber-500" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        form.destaque ? "translate-x-4" : ""
                      }`}
                    />
                  </div>
                  <span className="text-sm text-zinc-700">Destaque</span>
                </button>

                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, disponivel: !f.disponivel }))}
                  className="flex items-center gap-3"
                >
                  <div
                    className={`relative w-10 h-6 rounded-full transition-colors ${
                      form.disponivel ? "bg-green-500" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        form.disponivel ? "translate-x-4" : ""
                      }`}
                    />
                  </div>
                  <span className="text-sm text-zinc-700">Disponível</span>
                </button>
              </div>
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
                className="font-bold px-6 py-2.5 rounded-xl text-sm disabled:opacity-50 shadow-sm hover:opacity-90 transition-opacity"
                style={{ background: "#3B2415", color: "#F6F0E5" }}
              >
                {salvando ? "Salvando..." : editandoId ? "Salvar Alterações" : "Criar Produto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
