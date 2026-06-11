"use client";

import { useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setCarregando(true);
      setErro(null);

      const result = await signIn("credentials", {
        email,
        senha,
        redirect: false,
      });

      if (result?.error) {
        setErro("Email ou senha incorretos");
        setCarregando(false);
      } else {
        router.push("/painel/pedidos");
      }
    },
    [email, senha, router]
  );

  return (
    <div className="h-full flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">☕</div>
          <h1 className="font-display text-3xl font-bold text-cb-amber">Coffee & Beats</h1>
          <p className="text-zinc-400 mt-2">Painel Operacional</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@coffeeandbeats.com"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3
                         text-zinc-100 font-sans placeholder:text-zinc-600
                         focus:outline-none focus:border-cb-amber transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3
                         text-zinc-100 font-sans placeholder:text-zinc-600
                         focus:outline-none focus:border-cb-amber transition-colors"
            />
          </div>

          {erro && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-400 text-sm">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-cb-amber text-cb-espresso font-bold font-sans text-lg
                       py-4 rounded-xl transition-opacity disabled:opacity-60 mt-2"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
