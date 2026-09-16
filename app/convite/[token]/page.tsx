"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

export default function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [invalido, setInvalido] = useState(false);
  const [nome, setNome]   = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro]   = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(function() {
    fetch("/api/convite/" + token)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) {
          setNome(d.data.nome);
        } else {
          setInvalido(true);
        }
      })
      .catch(function() { setInvalido(true); })
      .finally(function() { setCarregando(false); });
  }, [token]);

  async function criarSenha() {
    setErro("");
    if (senha.length < 6) { setErro("A senha deve ter pelo menos 6 caracteres."); return; }
    if (senha !== confirmacao) { setErro("As senhas não conferem."); return; }

    setSalvando(true);
    try {
      var r = await fetch("/api/convite/" + token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha: senha, confirmacao: confirmacao }),
      });
      var d = await r.json();
      if (d.ok) {
        router.push("/login?msg=" + encodeURIComponent("Senha criada! Faça seu login."));
      } else {
        setErro(d.error ?? "Erro ao criar senha.");
      }
    } catch (e) {
      setErro("Sem conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: "#F6F0E5" }}>
        <span style={{ color: "rgba(59,36,21,0.4)" }}>Verificando link...</span>
      </div>
    );
  }

  if (invalido) {
    return (
      <div className="h-screen w-screen flex items-center justify-center px-8" style={{ background: "#F6F0E5" }}>
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg px-8 py-10 text-center flex flex-col items-center gap-3">
          <span className="text-4xl">⚠️</span>
          <p className="font-bold text-lg" style={{ color: "#3B2415" }}>
            Link inválido ou expirado
          </p>
          <p className="text-sm" style={{ color: "rgba(59,36,21,0.6)" }}>
            Solicite um novo ao administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center px-8" style={{ background: "#F6F0E5" }}>
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg px-8 py-10 flex flex-col gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Coffee & Beats" className="w-20 h-20 object-contain mx-auto" />

        <div className="text-center">
          <h1 className="font-extrabold text-xl" style={{ color: "#3B2415" }}>
            Olá! Crie sua senha
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(59,36,21,0.6)" }}>
            para acessar o sistema.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "rgba(59,36,21,0.7)" }}>
              Nome
            </label>
            <input
              type="text"
              value={nome}
              readOnly
              className="w-full bg-zinc-50 rounded-xl px-4 py-3 text-sm"
              style={{ border: "1px solid rgba(59,36,21,0.15)", color: "rgba(59,36,21,0.6)" }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "rgba(59,36,21,0.7)" }}>
              Nova senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={function(e) { setSenha(e.target.value); setErro(""); }}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-white rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: "1px solid rgba(59,36,21,0.2)", color: "#3B2415" }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "rgba(59,36,21,0.7)" }}>
              Confirmar senha
            </label>
            <input
              type="password"
              value={confirmacao}
              onChange={function(e) { setConfirmacao(e.target.value); setErro(""); }}
              onKeyDown={function(e) { if (e.key === "Enter") criarSenha(); }}
              placeholder="Repita a senha"
              className="w-full bg-white rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: "1px solid rgba(59,36,21,0.2)", color: "#3B2415" }}
            />
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {erro}
            </div>
          )}
        </div>

        <button
          onClick={criarSenha}
          disabled={salvando}
          className="w-full font-bold text-lg py-4 rounded-xl transition-opacity disabled:opacity-60 hover:opacity-90"
          style={{ background: "#3B2415", color: "#F6F0E5" }}
        >
          {salvando ? "Criando..." : "CRIAR MINHA SENHA"}
        </button>
      </div>
    </div>
  );
}
