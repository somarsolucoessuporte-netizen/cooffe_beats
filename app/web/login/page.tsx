"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseWebClient } from "@/lib/supabase-web";

function formatarWhatsApp(valor: string): string {
  var nums = valor.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 2)  return "(" + nums;
  if (nums.length <= 7)  return "(" + nums.slice(0, 2) + ") " + nums.slice(2);
  if (nums.length <= 11) return "(" + nums.slice(0, 2) + ") " + nums.slice(2, 7) + "-" + nums.slice(7);
  return "(" + nums.slice(0, 2) + ") " + nums.slice(2, 7) + "-" + nums.slice(7, 11);
}

type Aba = "entrar" | "cadastrar";

function LoginConteudo() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirect     = searchParams.get("redirect") ?? "/web/cardapio";

  const [aba,       setAba]       = useState<Aba>("entrar");
  const [email,     setEmail]     = useState("");
  const [senha,     setSenha]     = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [nome,      setNome]      = useState("");
  const [wpp,       setWpp]       = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro,      setErro]      = useState("");
  const [aviso,     setAviso]     = useState("");

  // Se já logado, redireciona
  useEffect(function () {
    var sb = createSupabaseWebClient();
    sb.auth.getSession().then(function ({ data }) {
      if (data.session) router.replace(redirect);
    });
  }, [router, redirect]);

  function limpar() { setErro(""); setAviso(""); }

  // ── Entrar com email/senha ──────────────────────────────────────────────
  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    limpar();
    if (!email || !senha) { setErro("Preencha email e senha."); return; }
    setCarregando(true);
    try {
      var sb = createSupabaseWebClient();
      var { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) { setErro("Email ou senha incorretos."); return; }
      router.push(redirect);
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  // ── Criar conta com email/senha ─────────────────────────────────────────
  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    limpar();
    var nomeT = nome.trim();
    var nums  = wpp.replace(/\D/g, "");
    if (!nomeT)          { setErro("Informe seu nome."); return; }
    if (nums.length < 10) { setErro("WhatsApp inválido."); return; }
    if (!email)          { setErro("Informe o email."); return; }
    if (senha.length < 6) { setErro("Senha deve ter ao menos 6 caracteres."); return; }
    if (senha !== confirmar) { setErro("As senhas não coincidem."); return; }

    setCarregando(true);
    try {
      var sb  = createSupabaseWebClient();
      var wppFmt = "55" + nums;

      var { data, error } = await sb.auth.signUp({
        email,
        password: senha,
        options: {
          data: { full_name: nomeT, whatsapp: wppFmt },
        },
      });

      if (error) { setErro(error.message); return; }

      if (data.session) {
        // Email confirmation desativado → sessão imediata → criar cliente
        await fetch("/api/web/auth/upsert-cliente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: nomeT, whatsapp: wppFmt }),
        });
        router.push(redirect);
      } else {
        // Email confirmation ativado → avisar usuário
        setAviso("Conta criada! Verifique seu email para confirmar o cadastro.");
        setEmail(""); setSenha(""); setConfirmar(""); setNome(""); setWpp("");
      }
    } catch {
      setErro("Erro ao criar conta. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  // ── Google OAuth ────────────────────────────────────────────────────────
  async function entrarGoogle() {
    limpar();
    setCarregando(true);
    try {
      var sb = createSupabaseWebClient();
      var callbackUrl = window.location.origin + "/api/web/auth/callback";
      var { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) { setErro("Erro ao iniciar login com Google."); setCarregando(false); }
      // Sucesso: browser redireciona para Google — não executa mais nada aqui
    } catch {
      setErro("Erro de conexão."); setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
         style={{ background: "#F6F0E5" }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Coffee & Beats" className="w-20 h-20 object-contain mb-3" />
          <h1 className="text-2xl font-extrabold text-cb-marrom">Coffee &amp; Beats</h1>
          <p className="text-cb-marrom/50 text-sm mt-1">Peça online e acompanhe em tempo real</p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-cb-marrom/10">
            {(["entrar", "cadastrar"] as Aba[]).map(function (a) {
              return (
                <button
                  key={a}
                  onClick={function () { setAba(a); limpar(); }}
                  className={
                    "flex-1 py-3.5 text-sm font-bold transition-colors " +
                    (aba === a
                      ? "text-cb-marrom border-b-2 border-cb-marrom bg-cb-bege/40"
                      : "text-cb-marrom/40 hover:text-cb-marrom/70")
                  }
                >
                  {a === "entrar" ? "Entrar" : "Criar conta"}
                </button>
              );
            })}
          </div>

          <div className="p-8">
            {/* Botão Google */}
            <button
              onClick={entrarGoogle}
              disabled={carregando}
              className="w-full flex items-center justify-center gap-3 border-2 border-gray-200
                         rounded-2xl py-3 px-4 font-semibold text-gray-700 text-sm
                         hover:border-gray-300 hover:bg-gray-50 transition-colors
                         disabled:opacity-60 mb-6"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar com Google
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-cb-marrom/10" />
              <span className="text-cb-marrom/30 text-xs">ou</span>
              <div className="flex-1 h-px bg-cb-marrom/10" />
            </div>

            {/* Feedback */}
            {erro   && <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{erro}</div>}
            {aviso  && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">{aviso}</div>}

            {/* Formulário Entrar */}
            {aba === "entrar" && (
              <form onSubmit={entrar} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={function (e) { setEmail(e.target.value); limpar(); }}
                    placeholder="seu@email.com"
                    required
                    className="border border-cb-marrom/20 rounded-xl px-4 py-3 text-cb-marrom text-sm
                               bg-white focus:outline-none focus:border-cb-amber transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Senha</label>
                  <input
                    type="password"
                    value={senha}
                    onChange={function (e) { setSenha(e.target.value); limpar(); }}
                    placeholder="••••••••"
                    required
                    className="border border-cb-marrom/20 rounded-xl px-4 py-3 text-cb-marrom text-sm
                               bg-white focus:outline-none focus:border-cb-amber transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={carregando}
                  className="w-full bg-cb-marrom text-cb-bege font-extrabold py-3.5 rounded-2xl
                             text-sm hover:bg-cb-marrom/90 transition-colors disabled:opacity-60 mt-1"
                >
                  {carregando ? "Entrando..." : "Entrar"}
                </button>
              </form>
            )}

            {/* Formulário Cadastrar */}
            {aba === "cadastrar" && (
              <form onSubmit={cadastrar} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Nome completo</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={function (e) { setNome(e.target.value); limpar(); }}
                    placeholder="João Silva"
                    required
                    className="border border-cb-marrom/20 rounded-xl px-4 py-3 text-cb-marrom text-sm
                               bg-white focus:outline-none focus:border-cb-amber transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">WhatsApp</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={wpp}
                    onChange={function (e) { setWpp(formatarWhatsApp(e.target.value)); limpar(); }}
                    placeholder="(85) 99999-9999"
                    required
                    className="border border-cb-marrom/20 rounded-xl px-4 py-3 text-cb-marrom text-sm
                               bg-white focus:outline-none focus:border-cb-amber transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={function (e) { setEmail(e.target.value); limpar(); }}
                    placeholder="seu@email.com"
                    required
                    className="border border-cb-marrom/20 rounded-xl px-4 py-3 text-cb-marrom text-sm
                               bg-white focus:outline-none focus:border-cb-amber transition-colors"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Senha</label>
                    <input
                      type="password"
                      value={senha}
                      onChange={function (e) { setSenha(e.target.value); limpar(); }}
                      placeholder="••••••"
                      required
                      className="border border-cb-marrom/20 rounded-xl px-4 py-3 text-cb-marrom text-sm
                                 bg-white focus:outline-none focus:border-cb-amber transition-colors"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Confirmar</label>
                    <input
                      type="password"
                      value={confirmar}
                      onChange={function (e) { setConfirmar(e.target.value); limpar(); }}
                      placeholder="••••••"
                      required
                      className="border border-cb-marrom/20 rounded-xl px-4 py-3 text-cb-marrom text-sm
                                 bg-white focus:outline-none focus:border-cb-amber transition-colors"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={carregando}
                  className="w-full bg-cb-marrom text-cb-bege font-extrabold py-3.5 rounded-2xl
                             text-sm hover:bg-cb-marrom/90 transition-colors disabled:opacity-60 mt-1"
                >
                  {carregando ? "Criando conta..." : "Criar conta"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F6F0E5" }}>
        <span className="text-cb-marrom/40">Carregando...</span>
      </div>
    }>
      <LoginConteudo />
    </Suspense>
  );
}
