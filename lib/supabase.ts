import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = 'https://jasnnodtxmvudgwrqcpx.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_-RKTgLdQ5HCrOmklgx30Zg_f8DvkPOB'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL      ?? SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? SUPABASE_ANON_KEY
)

// supabaseAdmin — server-side only (API routes)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL   ?? SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  ?? SUPABASE_ANON_KEY
)
