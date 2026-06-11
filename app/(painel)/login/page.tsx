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

      const result = await signIn("credentials", { email, senha, redirect: false });

      if (result?.error) {
        setErro("Email ou senha incorretos");
        setCarregando(false);
      } else {
        router.push("/pedidos");
      }
    },
    [email, senha, router]
  );

  return (
    <div className="h-full flex items-center justify-center" style={{ background: "#F6F0E5" }}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg px-8 py-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Coffee & Beats" className="w-40 object-contain mb-4" />
          <p className="font-extrabold text-xl" style={{ color: "#3B2415" }}>
            Painel Operacional
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: "rgba(59,36,21,0.7)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@coffeeandbeats.com"
              className="w-full bg-white rounded-xl px-4 py-3 font-sans text-sm
                         focus:outline-none transition-colors"
              style={{
                border: "1px solid rgba(59,36,21,0.2)",
                color: "#3B2415",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3B2415")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(59,36,21,0.2)")}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: "rgba(59,36,21,0.7)" }}>
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-white rounded-xl px-4 py-3 font-sans text-sm
                         focus:outline-none transition-colors"
              style={{
                border: "1px solid rgba(59,36,21,0.2)",
                color: "#3B2415",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3B2415")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(59,36,21,0.2)")}
            />
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full font-bold font-sans text-lg py-4 rounded-xl
                       transition-opacity disabled:opacity-60 mt-2 hover:opacity-90"
            style={{ background: "#3B2415", color: "#F6F0E5" }}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
