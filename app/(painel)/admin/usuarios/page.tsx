"use client";

import { useEffect, useState, useCallback } from "react";

type Perfil = "ADMIN" | "GERENTE" | "BARISTA" | "ATENDENTE";
type Usuario = {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  criadoEm: string;
  senhaDefinida: boolean;
};
type FormData = {
  nome: string;
  email: string;
  senha: string;
  perfil: Perfil;
  ativo: boolean;
};

const FORM_VAZIO: FormData = {
  nome: "",
  email: "",
  senha: "",
  perfil: "ATENDENTE",
  ativo: true,
};

const PERFIL_LABELS: Record<Perfil, { label: string; cor: string }> = {
  ADMIN: { label: "Admin", cor: "bg-red-100 text-red-700" },
  GERENTE: { label: "Gerente", cor: "bg-amber-100 text-amber-700" },
  BARISTA: { label: "Barista", cor: "bg-blue-100 text-blue-700" },
  ATENDENTE: { label: "Atendente", cor: "bg-green-100 text-green-700" },
};

const inputClass =
  "w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-zinc-900 text-sm focus:outline-none focus:border-[#3B2415] focus:ring-1 focus:ring-[#3B2415]/10";

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/admin/usuarios");
    const data = await res.json();
    if (data.ok) setUsuarios(data.data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirCriar = () => {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setModalAberto(true);
    setMsg(null);
  };

  const abrirEditar = (u: Usuario) => {
    setEditandoId(u.id);
    setForm({ nome: u.nome, email: u.email, senha: "", perfil: u.perfil, ativo: u.ativo });
    setModalAberto(true);
    setMsg(null);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditandoId(null);
    setForm(FORM_VAZIO);
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.email.trim()) {
      setMsg({ tipo: "erro", texto: "Nome e email são obrigatórios." });
      return;
    }
    setSalvando(true);
    try {
      if (editandoId) {
        const body: Partial<FormData> = { ...form };
        if (!body.senha) delete body.senha;

        const res = await fetch(`/api/admin/usuarios/${editandoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.ok) {
          fecharModal();
          setMsg({ tipo: "ok", texto: "Usuário atualizado!" });
          carregar();
        } else {
          setMsg({ tipo: "erro", texto: data.error ?? "Erro ao salvar." });
        }
      } else {
        const res = await fetch("/api/admin/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: form.nome, email: form.email, perfil: form.perfil, ativo: form.ativo }),
        });
        const data = await res.json();
        if (data.ok) {
          fecharModal();
          setLinkConvite(data.data.conviteUrl);
          carregar();
        } else {
          setMsg({ tipo: "erro", texto: data.error ?? "Erro ao gerar convite." });
        }
      }
    } finally {
      setSalvando(false);
    }
  };

  const desativar = async (id: string) => {
    if (!confirm("Desativar este usuário?")) return;
    await fetch(`/api/admin/usuarios/${id}`, { method: "DELETE" });
    carregar();
  };

  const reenviarConvite = async (id: string) => {
    setReenviandoId(id);
    try {
      const res = await fetch(`/api/admin/usuarios/${id}/reenviar-convite`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setLinkConvite(data.data.conviteUrl);
      } else {
        setMsg({ tipo: "erro", texto: data.error ?? "Erro ao reenviar convite." });
      }
    } finally {
      setReenviandoId(null);
    }
  };

  const copiarLink = async () => {
    if (!linkConvite) return;
    try {
      await navigator.clipboard.writeText(linkConvite);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setMsg({ tipo: "erro", texto: "Não foi possível copiar. Selecione e copie manualmente." });
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#3B2415]">Usuários</h1>
          <p className="text-[#3B2415]/60 text-sm mt-0.5">{usuarios.length} cadastrados</p>
        </div>
        <button
          onClick={abrirCriar}
          className="font-bold px-5 py-2.5 rounded-xl text-sm shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: "#3B2415", color: "#F6F0E5" }}
        >
          + Novo Usuário
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
              {["Usuário", "Email", "Perfil", "Status", "Acesso", ""].map((h) => (
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
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="h-5 bg-zinc-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              : usuarios.length === 0
              ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-zinc-400 text-sm">
                      Nenhum usuário cadastrado.
                    </td>
                  </tr>
                )
              : usuarios.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-b border-zinc-100 hover:bg-zinc-50 transition-colors ${
                      !u.ativo ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 font-bold text-sm shrink-0">
                          {u.nome[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-zinc-900">{u.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          PERFIL_LABELS[u.perfil].cor
                        }`}
                      >
                        {PERFIL_LABELS[u.perfil].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.ativo
                            ? "bg-green-100 text-green-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.senhaDefinida ? (
                        <span className="text-xs text-zinc-400">—</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                          Convite pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!u.senhaDefinida && (
                          <button
                            onClick={() => reenviarConvite(u.id)}
                            disabled={reenviandoId === u.id}
                            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Reenviar convite"
                          >
                            🔗
                          </button>
                        )}
                        <button
                          onClick={() => abrirEditar(u)}
                          className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                        >
                          ✏️
                        </button>
                        {u.ativo && (
                          <button
                            onClick={() => desativar(u.id)}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            🚫
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {(Object.entries(PERFIL_LABELS) as [Perfil, { label: string; cor: string }][]).map(
          ([perfil, { label, cor }]) => (
            <div key={perfil} className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${cor}`}>
                {label}
              </span>
              <span className="text-xs text-zinc-400">
                {perfil === "ADMIN" && "— acesso total"}
                {perfil === "GERENTE" && "— gestão + dashboard"}
                {perfil === "BARISTA" && "— apenas KDS"}
                {perfil === "ATENDENTE" && "— apenas pedidos"}
              </span>
            </div>
          )
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-zinc-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">
                {editandoId ? "Editar Usuário" : "Novo Usuário"}
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
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                  placeholder="email@exemplo.com"
                />
              </div>

              {editandoId ? (
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">
                    Senha (deixe em branco para manter)
                  </label>
                  <input
                    type="password"
                    value={form.senha}
                    onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                </div>
              ) : (
                <p className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5">
                  Ao criar, geramos um link de convite pra esse funcionário criar a própria senha.
                </p>
              )}

              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">
                  Perfil *
                </label>
                <select
                  value={form.perfil}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, perfil: e.target.value as Perfil }))
                  }
                  className={inputClass}
                >
                  <option value="ADMIN">Admin — acesso total</option>
                  <option value="GERENTE">Gerente — gestão + dashboard</option>
                  <option value="BARISTA">Barista — apenas KDS</option>
                  <option value="ATENDENTE">Atendente — apenas pedidos</option>
                </select>
              </div>

              {editandoId && (
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
                  <span className="text-sm text-zinc-700">Usuário ativo</span>
                </button>
              )}
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
                {salvando
                  ? editandoId ? "Salvando..." : "Gerando..."
                  : editandoId ? "Salvar Alterações" : "Gerar link de convite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {linkConvite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">Convite gerado!</h2>
              <button
                onClick={() => setLinkConvite(null)}
                className="text-zinc-400 hover:text-zinc-700 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                readOnly
                value={linkConvite}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-xs text-zinc-700"
              />
              <button
                onClick={copiarLink}
                className="shrink-0 font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm hover:opacity-90 transition-opacity"
                style={{ background: "#3B2415", color: "#F6F0E5" }}
              >
                {copiado ? "Copiado!" : "Copiar link"}
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Envie este link ao funcionário pelo WhatsApp. Ele expira em 7 dias.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
