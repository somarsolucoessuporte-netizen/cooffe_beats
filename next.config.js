const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@supabase/supabase-js", "@supabase/ssr"],
}

module.exports = withPWA(nextConfig)
