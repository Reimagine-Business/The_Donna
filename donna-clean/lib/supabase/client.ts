import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/supabase/types'

export const createBrowserClient = () =>
  createBrowserSupabaseClient<Database>({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  })

export const createClient = () => createBrowserClient()
