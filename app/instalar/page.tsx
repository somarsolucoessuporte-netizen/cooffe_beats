import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Configuração do Dispositivo — Coffee & Beats",
};

const ATALHOS = [
  {
    href: "/instalar/totem",
    emoji: "☕",
    titulo: "TOTEM",
    subtitulo: "Tela do Cliente",
    descricao: "Instale este atalho para o cliente fazer pedidos em autoatendimento.",
    bgCard: "#F6F0E5",
    bgBotao: "#3B2415",
    textoBotao: "#F6F0E5",
  },
  {
    href: "/instalar/admin",
    emoji: "⚙️",
    titulo: "ADMIN",
    subtitulo: "Gestão",
    descricao: "Para gerenciar produtos, categorias e preços.",
    bgCard: "#3B2415",
    bgBotao: "#C8853A",
    textoBotao: "#3B2415",
  },
  {
    href: "/instalar/pedidos",
    emoji: "📋",
    titulo: "PEDIDOS",
    subtitulo: "Operação",
    descricao: "Para acompanhar pedidos em tempo real no painel.",
    bgCard: "#C8853A",
    bgBotao: "#3B2415",
    textoBotao: "#F6F0E5",
  },
];

export default function InstalarPage() {
  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-6 gap-10"
         style={{ background: "#F6F0E5" }}>
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Coffee & Beats" className="w-32 object-contain" />

      <div className="text-center">
        <h1 className="font-extrabold text-3xl" style={{ color: "#3B2415" }}>
          Configuração do Dispositivo
        </h1>
        <p className="text-sm mt-2" style={{ color: "rgba(59,36,21,0.5)" }}>
          Instale os atalhos na tela inicial do SUNMI D2 Mini
        </p>
      </div>

      {/* Cards */}
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
                <p className="font-extrabold text-lg" style={{ color: bgBotao }}>
                  {titulo}
                </p>
                <p className="text-sm" style={{ color: bgBotao, opacity: 0.7 }}>
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

      {/* Instruções */}
      <div className="w-full max-w-md rounded-2xl p-6 text-sm" style={{ background: "white" }}>
        <p className="font-extrabold mb-3" style={{ color: "#3B2415" }}>
          Como instalar:
        </p>
        <ol className="flex flex-col gap-2 list-decimal list-inside" style={{ color: "rgba(59,36,21,0.7)" }}>
          <li>Toque no botão do atalho desejado acima</li>
          <li>No menu do Chrome (⋮): <strong>Adicionar à tela inicial</strong></li>
          <li>Confirme o nome e toque em <strong>Adicionar</strong></li>
          <li>O ícone aparecerá na tela inicial do dispositivo</li>
        </ol>
      </div>
    </div>
  );
}
