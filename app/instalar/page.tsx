import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Configuração do Dispositivo — Coffee & Beats",
};

const BASE = "https://coffeebeats.somar.ia.br";

const ATALHOS = [
  {
    href: "/instalar/totem",
    emoji: "☕",
    titulo: "TOTEM",
    subtitulo: "Tela do Cliente",
    descricao: "Autoatendimento — o cliente faz o pedido aqui.",
    bgCard: "#F6F0E5",
    bgBotao: "#3B2415",
    textoBotao: "#F6F0E5",
    intentUrl: `intent://${BASE.replace("https://", "")}/#Intent;scheme=https;package=com.android.chrome;end`,
  },
  {
    href: "/instalar/admin",
    emoji: "⚙️",
    titulo: "ADMIN",
    subtitulo: "Gestão",
    descricao: "Produtos, categorias e preços.",
    bgCard: "#3B2415",
    bgBotao: "#C8853A",
    textoBotao: "#3B2415",
    intentUrl: `intent://${BASE.replace("https://", "")}/instalar/admin#Intent;scheme=https;package=com.android.chrome;end`,
  },
  {
    href: "/instalar/pedidos",
    emoji: "📋",
    titulo: "PEDIDOS",
    subtitulo: "Operação",
    descricao: "Acompanhamento de pedidos em tempo real.",
    bgCard: "#C8853A",
    bgBotao: "#3B2415",
    textoBotao: "#F6F0E5",
    intentUrl: `intent://${BASE.replace("https://", "")}/instalar/pedidos#Intent;scheme=https;package=com.android.chrome;end`,
  },
];

export default function InstalarPage() {
  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-6 gap-8" style={{ background: "#F6F0E5" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Coffee & Beats" className="w-28 object-contain" />

      <div className="text-center">
        <h1 className="font-extrabold text-3xl" style={{ color: "#3B2415" }}>
          Configuração do Dispositivo
        </h1>
        <p className="text-sm mt-2" style={{ color: "rgba(59,36,21,0.5)" }}>
          Instale os 3 atalhos na tela inicial do SUNMI D2 Mini
        </p>
      </div>

      {/* Cards dos 3 atalhos */}
      <div className="flex flex-col gap-4 w-full max-w-md">
        {ATALHOS.map(({ href, emoji, titulo, subtitulo, descricao, bgCard, bgBotao, textoBotao }) => (
          <div
            key={href}
            className="rounded-3xl p-6 flex flex-col gap-4 shadow-sm"
            style={{ background: bgCard }}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{emoji}</span>
              <div>
                <p className="font-extrabold text-lg leading-none" style={{ color: bgBotao }}>
                  {titulo}
                </p>
                <p className="text-xs mt-0.5" style={{ color: bgBotao, opacity: 0.7 }}>
                  {subtitulo}
                </p>
              </div>
            </div>
            <p className="text-sm" style={{ color: bgBotao, opacity: 0.8 }}>
              {descricao}
            </p>
            <Link
              href={href}
              className="text-center font-extrabold py-3 px-6 rounded-2xl text-sm"
              style={{ background: bgBotao, color: textoBotao }}
            >
              Instalar {titulo}
            </Link>
          </div>
        ))}
      </div>

      {/* Instruções Firefox Android */}
      <div className="w-full max-w-md rounded-2xl p-6 text-sm" style={{ background: "white" }}>
        <p className="font-extrabold mb-3" style={{ color: "#3B2415" }}>
          Como instalar (passo a passo):
        </p>
        <ol className="flex flex-col gap-2 list-decimal list-inside" style={{ color: "rgba(59,36,21,0.7)" }}>
          <li>Toque em <strong>&quot;Instalar [NOME]&quot;</strong> no card acima</li>
          <li>Aguarde a página carregar completamente</li>
          <li>
            <strong>Chrome (⋮):</strong> Menu → &quot;Adicionar à tela inicial&quot;
          </li>
          <li>
            <strong>Firefox 🏠:</strong> ícone de casa na barra de endereço → &quot;Instalar&quot;
            <br />
            <span className="text-xs opacity-70">ou Menu (⋮) → &quot;Instalar&quot;</span>
          </li>
          <li>Confirme o nome e toque em <strong>Adicionar</strong></li>
          <li>O ícone correto aparecerá na tela inicial</li>
        </ol>
      </div>

      {/* Links diretos via Intent Android (fallback para Chrome) */}
      <div className="w-full max-w-md rounded-2xl p-6 text-sm" style={{ background: "rgba(59,36,21,0.05)" }}>
        <p className="font-extrabold mb-1" style={{ color: "#3B2415" }}>
          Atalhos diretos (abre no Chrome):
        </p>
        <p className="text-xs mb-3" style={{ color: "rgba(59,36,21,0.5)" }}>
          Use se o botão acima não abrir o navegador correto.
        </p>
        <div className="flex flex-col gap-2">
          {ATALHOS.map(({ intentUrl, emoji, titulo }) => (
            <a
              key={titulo}
              href={intentUrl}
              className="text-center font-semibold py-2 px-4 rounded-xl text-sm border"
              style={{ color: "#3B2415", borderColor: "rgba(59,36,21,0.2)" }}
            >
              {emoji} Abrir {titulo} no Chrome
            </a>
          ))}
        </div>
      </div>

      <p className="text-xs text-center pb-4" style={{ color: "rgba(59,36,21,0.3)" }}>
        coffeebeats.somar.ia.br/instalar
      </p>
    </div>
  );
}
