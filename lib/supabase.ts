// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client (uses anon key, respects Row Level Security)
export const supabase = createClient(url, anon)

// Server client (uses service role key — only use in API routes/cron)
export function createServiceClient() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}
