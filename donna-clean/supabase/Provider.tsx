"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

const SupabaseContext = createContext<SupabaseClient | null>(null);

type SupabaseProviderProps = {
  children: ReactNode;
  client: SupabaseClient;
};

export function SupabaseProvider({ children, client }: SupabaseProviderProps) {
  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[SupabaseProvider] Supabase client missing – skipping provider render.");
    }
    return <>{children}</>;
  }

  return (
    <SupabaseContext.Provider value={client}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabaseClient() {
  const client = useContext(SupabaseContext);

  if (!client) {
    throw new Error("[SupabaseProvider] Supabase client is not available in context.");
  }

  return client;
}
