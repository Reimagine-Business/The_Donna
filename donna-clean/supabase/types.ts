export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      entries: {
        Row: {
          amount: number
          category: 'Sales' | 'COGS' | 'Opex' | 'Assets'
          created_at: string
          entry_date: string
          entry_type: 'Cash Inflow' | 'Cash Outflow' | 'Credit' | 'Advance'
          id: string
          image_url: string | null
          notes: string | null
          payment_method: 'Cash' | 'Bank' | 'None'
          remaining_amount: number | null
          settled: boolean
          settled_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: 'Sales' | 'COGS' | 'Opex' | 'Assets'
          created_at?: string
          entry_date?: string
          entry_type: 'Cash Inflow' | 'Cash Outflow' | 'Credit' | 'Advance'
          id?: string
          image_url?: string | null
          notes?: string | null
          payment_method?: 'Cash' | 'Bank' | 'None'
          remaining_amount?: number | null
          settled?: boolean
          settled_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: 'Sales' | 'COGS' | 'Opex' | 'Assets'
          created_at?: string
          entry_date?: string
          entry_type?: 'Cash Inflow' | 'Cash Outflow' | 'Credit' | 'Advance'
          id?: string
          image_url?: string | null
          notes?: string | null
          payment_method?: 'Cash' | 'Bank' | 'None'
          remaining_amount?: number | null
          settled?: boolean
          settled_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'entries_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          business_name: string | null
          created_at: string | null
          id: string
          role: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string | null
          id: string
          role?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string | null
          id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
