import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Instalar Pedidos — Coffee & Beats",
  manifest: "/manifest-pedidos.json",
};

export default function InstalarPedidosPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8 p-8"
      style={{ background: "#C8853A" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Coffee & Beats" className="w-40 object-contain" />

      <div className="text-center">
        <p className="text-4xl mb-2">📋</p>
        <h1 className="font-extrabold text-2xl" style={{ color: "#3B2415" }}>
          CB Pedidos
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(59,36,21,0.7)" }}>
          Painel de acompanhamento de pedidos
        </p>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-6 text-sm text-center"
        style={{ background: "rgba(255,255,255,0.3)" }}
      >
        <p className="font-extrabold mb-2" style={{ color: "#3B2415" }}>
          Para instalar:
        </p>
        <p style={{ color: "rgba(59,36,21,0.8)" }}>
          No menu do Chrome <strong>(⋮)</strong>, toque em{" "}
          <strong>&quot;Adicionar à tela inicial&quot;</strong> e confirme.
        </p>
      </div>

      <Link
        href="/login?redirect=/pedidos"
        className="font-extrabold py-4 px-10 rounded-full text-lg"
        style={{ background: "#3B2415", color: "#F6F0E5" }}
      >
        Abrir Painel
      </Link>

      <Link href="/instalar" className="text-sm underline" style={{ color: "rgba(59,36,21,0.6)" }}>
        ← Voltar à configuração
      </Link>
    </div>
  );
}
