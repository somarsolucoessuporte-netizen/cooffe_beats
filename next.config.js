/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@supabase/supabase-js",
    "@supabase/ssr",
    "@supabase/realtime-js",
    "@supabase/postgrest-js",
  ],
  compiler: {
    // Mantém error/warn/info: sem isso os logs de falha do Mercado Pago e o aviso
    // "PAGAMENTO DUPLICADO" eram removidos do build de produção.
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn", "info"] } : false,
  },
  turbopack: {},
  async headers() {
    // Telas de pagamento e APIs nunca podem ser servidas de cache (versão antiga após deploy).
    return [
      { source: "/pagamento", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] },
      { source: "/api/pagamentos/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
}

module.exports = nextConfig
