import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(
  supabaseUrl     || 'https://jasnnodtxmvudgwrqcpx.supabase.co',
  supabaseAnonKey || 'sb_publishable_-RKTgLdQ5HCrOmklgx30Zg_f8DvkPOB'
)

// Nunca expor no browser — apenas API routes (server-side)
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://jasnnodtxmvudgwrqcpx.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)
