import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export const createBrowserClient = () =>
  createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

export const createClient = () => createBrowserClient()

export const supabase = createBrowserClient()
