import type { SupabaseClient } from "@supabase/supabase-js"

type EntryType = string
type CategoryType = string

/**
 * Determines the cash-flow direction of an entry.
 * Cash Pulse counts: Cash IN, Cash OUT, and Advance (direction depends on category).
 * Credit entries do NOT affect cash balance.
 */
function getCashDelta(entryType: EntryType, category: CategoryType, amount: number): number {
  if (entryType === 'Cash IN') return amount
  if (entryType === 'Cash OUT') return -amount
  if (entryType === 'Advance') {
    // Advance with Sales = money received (inflow)
    // Advance with COGS/Opex/Assets = money paid out (outflow)
    return category === 'Sales' ? amount : -amount
  }
  // Credit and settlement types don't affect cash balance
  return 0
}

/**
 * Updates the stored running cash balance on the user's profile.
 *
 * Call this after every entry create / update / delete so that
 * alert generation can read the balance directly instead of
 * scanning the entire entries table.
 */
export async function updateRunningBalance(
  supabase: SupabaseClient,
  userId: string,
  entryType: EntryType,
  category: CategoryType,
  amount: number,
  operation: 'create' | 'delete' | 'update' = 'create',
  oldEntry?: { entry_type: EntryType; category: CategoryType; amount: number }
): Promise<number> {
  // Get current stored balance
  const { data: profile } = await supabase
    .from('profiles')
    .select('running_cash_balance')
    .eq('user_id', userId)
    .maybeSingle()

  let balance: number = profile?.running_cash_balance ?? 0

  if (operation === 'delete') {
    // Reverse the entry's effect
    balance -= getCashDelta(entryType, category, amount)
  } else if (operation === 'update' && oldEntry) {
    // Reverse old entry, apply new entry
    balance -= getCashDelta(oldEntry.entry_type, oldEntry.category, oldEntry.amount)
    balance += getCashDelta(entryType, category, amount)
  } else {
    // Create: apply the new entry
    balance += getCashDelta(entryType, category, amount)
  }

  // Persist
  await supabase
    .from('profiles')
    .update({
      running_cash_balance: balance,
      balance_last_updated: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return balance
}

/**
 * Recalculates the running balance from scratch by scanning all entries.
 * Use this as a one-time migration or periodic consistency check,
 * NOT on every entry creation.
 */
export async function recalculateBalance(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: entries, error } = await supabase
    .from('entries')
    .select('entry_type, category, amount')
    .eq('user_id', userId)

  if (error || !entries) {
    console.error('[RECALCULATE_BALANCE] Failed:', error)
    return 0
  }

  const balance = entries.reduce(
    (sum, e) => sum + getCashDelta(e.entry_type, e.category, e.amount),
    0
  )

  await supabase
    .from('profiles')
    .update({
      running_cash_balance: balance,
      balance_last_updated: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return balance
}
