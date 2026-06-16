import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Instalar Admin — Coffee & Beats",
};

export default function InstalarAdminPage() {
  return (
    <>
      {/* React 19 hoist: sobrescreve o manifest do layout raiz */}
      <link rel="manifest" href="/api/manifest/admin" />
      <meta name="theme-color" content="#3B2415" />

      <div
        className="min-h-screen flex flex-col items-center justify-center gap-8 p-8"
        style={{ background: "#3B2415" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Coffee & Beats" className="w-40 object-contain brightness-0 invert" />

        <div className="text-center">
          <p className="text-4xl mb-2">⚙️</p>
          <h1 className="font-extrabold text-2xl" style={{ color: "#F6F0E5" }}>
            CB Admin
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(246,240,229,0.6)" }}>
            Gestão de produtos e preços
          </p>
        </div>

        <div
          className="w-full max-w-sm rounded-2xl p-6 text-sm"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          <p className="font-extrabold mb-3" style={{ color: "#F6F0E5" }}>
            Como instalar:
          </p>
          <ol className="flex flex-col gap-2 list-decimal list-inside" style={{ color: "rgba(246,240,229,0.8)" }}>
            <li>Aguarde a página carregar completamente</li>
            <li>
              <strong>Chrome:</strong> Menu (⋮) → &quot;Adicionar à tela inicial&quot;
            </li>
            <li>
              <strong>Firefox:</strong> ícone 🏠 na barra de endereço ou Menu → &quot;Instalar&quot;
            </li>
            <li>Confirme e toque em <strong>Adicionar</strong></li>
          </ol>
        </div>

        <Link
          href="/login"
          className="font-extrabold py-4 px-10 rounded-full text-lg"
          style={{ background: "#C8853A", color: "#3B2415" }}
        >
          Abrir Admin
        </Link>

        <Link href="/instalar" className="text-sm underline" style={{ color: "rgba(246,240,229,0.5)" }}>
          ← Voltar à configuração
        </Link>
      </div>
    </>
  );
}
