import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://coffeebeats.somar.ia.br";

const MANIFESTS: Record<string, object> = {
  totem: {
    name: "Coffee & Beats — Totem",
    short_name: "CB Totem",
    description: "Autoatendimento Coffee & Beats",
    start_url: `${BASE}/`,
    display: "fullscreen",
    orientation: "portrait",
    background_color: "#F6F0E5",
    theme_color: "#3B2415",
    icons: [
      { src: `${BASE}/icon-totem-192.png`, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: `${BASE}/icon-totem-512.png`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  },
  admin: {
    name: "Coffee & Beats — Admin",
    short_name: "CB Admin",
    description: "Gestão Coffee & Beats",
    start_url: `${BASE}/login?redirect=/admin/produtos`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#3B2415",
    theme_color: "#3B2415",
    icons: [
      { src: `${BASE}/icon-admin-192.png`, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: `${BASE}/icon-admin-512.png`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  },
  pedidos: {
    name: "Coffee & Beats — Pedidos",
    short_name: "CB Pedidos",
    description: "Painel de Pedidos Coffee & Beats",
    start_url: `${BASE}/login?redirect=/pedidos`,
    display: "standalone",
    orientation: "landscape",
    background_color: "#C8853A",
    theme_color: "#C8853A",
    icons: [
      { src: `${BASE}/icon-pedidos-192.png`, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: `${BASE}/icon-pedidos-512.png`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tipo: string }> }
) {
  const { tipo } = await params;
  const manifest = MANIFESTS[tipo];

  if (!manifest) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-cache",
    },
  });
}
