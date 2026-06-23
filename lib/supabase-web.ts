import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? "https://jasnnodtxmvudgwrqcpx.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_-RKTgLdQ5HCrOmklgx30Zg_f8DvkPOB";

// Retorna um browser client com gestão automática de cookies (para Client Components)
export function createSupabaseWebClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
