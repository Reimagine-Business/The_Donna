'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { SupabaseProvider } from '@/supabase/Provider'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const [supabaseClient] = useState(() => createBrowserClient())

  return (
    <SupabaseProvider client={supabaseClient}>
      {children}
    </SupabaseProvider>
  )
}
