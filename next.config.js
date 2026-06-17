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
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("@kduma-autoid/capacitor-sunmi-printer");
      config.externals.push("@capacitor/core");
    }
    return config;
  },
}

module.exports = nextConfig
