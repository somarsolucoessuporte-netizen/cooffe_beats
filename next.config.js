/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@supabase/supabase-js",
    "@supabase/ssr",
    "@supabase/realtime-js",
    "@supabase/postgrest-js",
  ],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  turbopack: {},
}

module.exports = nextConfig
