import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Cardápio da Mesa · Coffee & Beats",
};

// Impede o zoom automático do celular nos campos e mantém a largura do aparelho
export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor:   "#3B2415",
};

// Cardápio da mesa: só o conteúdo mobile (navbar e rodapé do portal ficam ocultos;
// a bottom nav vem do layout de /web em modo mesa)
export default function MesaMobileLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-white">{children}</div>;
}
