"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServerClient } from "@/utils/supabase/server"
import { getOrRefreshUser } from "@/lib/supabase/get-user"
import { validateEntry } from "@/lib/validation"
import {
  sanitizeString,
  sanitizeAmount,
  sanitizeDate
} from "@/lib/sanitization"
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit"
import * as Sentry from "@sentry/nextjs"
import type { SupabaseClient } from "@supabase/supabase-js"
import { updateRunningBalance } from "@/lib/balance"
// Re-export Entry type from canonical location
import type { Entry as LibEntry } from "@/lib/entries"

export type EntryType = 'Cash IN' | 'Cash OUT' | 'Credit' | 'Advance'
export type CategoryType = 'Sales' | 'COGS' | 'Opex' | 'Assets'
export type PaymentMethodType = 'Cash' | 'Bank' | 'None'

export type CreateEntryInput = {
  entry_type: EntryType
  category: CategoryType
  amount: number
  entry_date: string
  payment_method?: PaymentMethodType
  party_id?: string
  notes?: string
  settled?: boolean
  image_url?: string
}

export type UpdateEntryInput = Partial<CreateEntryInput>

// Re-export Entry type with optional is_settlement field for settlements
export type Entry = LibEntry & {
  is_settlement?: boolean
}

export type Category = {
  id: string
  user_id: string
  name: string
  type: 'income' | 'expense'
  color: string
  icon: string
  created_at: string
}

/**
 * Generate alerts based on entry data.
 * Uses the pre-calculated running balance (from profiles table) instead of
 * scanning the entire entries table. Only queries current-month entries
 * for profit lens alerts (scoped, not full scan).
 */
async function generateAlertsForEntry(
  supabase: SupabaseClient,
  userId: string,
  entry: { entry_type: EntryType; category: CategoryType; amount: number; entry_date: string },
  currentBalance: number
) {
  try {
    const alerts: Array<{
      user_id: string
      type: 'critical' | 'warning' | 'info'
      priority: number
      title: string
      message: string
      is_read: boolean
    }> = []

    // Alert 1: High single expense (> ₹50,000)
    if (['COGS', 'Opex', 'Assets'].includes(entry.category) && entry.amount > 50000) {
      alerts.push({
        user_id: userId,
        type: 'warning',
        priority: 7,
        title: 'High Expense Recorded',
        message: `A large expense of ₹${entry.amount.toLocaleString('en-IN')} was recorded in category "${entry.category}". Please review if this is expected.`,
        is_read: false,
      })
    }

    // Alert 2: Low cash balance (< ₹10,000) — uses pre-calculated balance
    if (currentBalance < 10000 && currentBalance >= 0) {
      alerts.push({
        user_id: userId,
        type: 'critical',
        priority: 9,
        title: 'Low Cash Balance',
        message: `Your current Cash Pulse balance is ₹${currentBalance.toLocaleString('en-IN')}. Consider reviewing cash outflows.`,
        is_read: false,
      })
    }

    // Alert 3: Negative balance — uses pre-calculated balance
    if (currentBalance < 0) {
      alerts.push({
        user_id: userId,
        type: 'critical',
        priority: 10,
        title: 'Negative Cash Balance Alert',
        message: `Your Cash Pulse balance is negative: ₹${currentBalance.toLocaleString('en-IN')}. Immediate attention required.`,
        is_read: false,
      })
    }

    // For monthly profit lens alerts, query ONLY the current month (scoped query)
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const { data: monthlyEntries } = await supabase
      .from('entries')
      .select('entry_type, category, amount')
      .eq('user_id', userId)
      .gte('entry_date', monthStart)

    if (monthlyEntries && monthlyEntries.length > 0) {
      const monthlyRevenue = monthlyEntries
        .filter((e: { entry_type: string; category: string }) =>
          e.category === 'Sales' &&
          (e.entry_type === 'Cash IN' || e.entry_type === 'Credit')
        )
        .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)
      const monthlyExpenses = monthlyEntries
        .filter((e: { entry_type: string; category: string }) =>
          ['COGS', 'Opex'].includes(e.category) &&
          (e.entry_type === 'Cash OUT' || e.entry_type === 'Credit')
        )
        .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)

      // Alert 4: Monthly expenses exceed revenue (Profit Lens)
      if (monthlyExpenses > monthlyRevenue && monthlyRevenue > 0) {
        const difference = monthlyExpenses - monthlyRevenue
        alerts.push({
          user_id: userId,
          type: 'warning',
          priority: 8,
          title: 'Monthly Expenses Exceed Revenue',
          message: `This month's expenses (₹${monthlyExpenses.toLocaleString('en-IN')}) exceed revenue (₹${monthlyRevenue.toLocaleString('en-IN')}) by ₹${difference.toLocaleString('en-IN')}.`,
          is_read: false,
        })
      }

      // Alert 5: Expenses significantly exceed revenue (>150%)
      if (monthlyRevenue > 0 && monthlyExpenses > monthlyRevenue * 1.5) {
        alerts.push({
          user_id: userId,
          type: 'critical',
          priority: 9,
          title: 'Excessive Spending Alert',
          message: `Your monthly expenses are ${((monthlyExpenses / monthlyRevenue) * 100).toFixed(0)}% of your revenue. This is not sustainable.`,
          is_read: false,
        })
      }
    }

    // Insert alerts into database (only if there are any)
    if (alerts.length > 0) {
      const { error: insertError } = await supabase
        .from('alerts')
        .insert(alerts)

      if (insertError) {
        console.error('Failed to insert alerts:', insertError)
      }
    }
  } catch (error) {
    console.error('Error in generateAlertsForEntry:', error)
  }
}

/**
 * Paginated entry fetch for the entries list page.
 * Supports server-side filtering by date range and entry type.
 */
export async function getEntries(options: {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
  entryType?: string
} = {}) {
  try {
    const supabase = await createSupabaseServerClient()
    const { user } = await getOrRefreshUser(supabase)

    if (!user) {
      console.error('[GET_ENTRIES] Not authenticated')
      return { entries: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0, hasMore: false, error: "Not authenticated" }
    }

    const {
      page = 1,
      pageSize = 50,
      startDate,
      endDate,
      entryType
    } = options

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('entries')
      .select(`
        *,
        party:parties(name)
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (startDate) query = query.gte('entry_date', startDate)
    if (endDate) query = query.lte('entry_date', endDate)
    if (entryType && entryType !== 'all') query = query.eq('entry_type', entryType)

    const { data, error, count } = await query

    if (error) {
      console.error('[GET_ENTRIES] Query error:', error)
      Sentry.captureException(error, { tags: { action: 'get-entries' } })
      return { entries: [], totalCount: 0, page, pageSize, totalPages: 0, hasMore: false, error: "Something went wrong. Please try again." }
    }

    const totalCount = count || 0

    return {
      entries: data as Entry[],
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
      hasMore: to < totalCount - 1,
      error: null
    }
  } catch (error) {
    console.error('[GET_ENTRIES] Unexpected error:', error)
    Sentry.captureException(error, { tags: { action: 'get-entries' } })
    return { entries: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0, hasMore: false, error: "Something went wrong. Please try again." }
  }
}

/**
 * Paginated fetch of all entries for a user.
 * Returns entries with total count for pagination UI.
 */
export async function getAllEntries(options: { page?: number; limit?: number } = {}) {
  try {
    const supabase = await createSupabaseServerClient()
    const { user } = await getOrRefreshUser(supabase)

    if (!user) {
      console.error('[GET_ALL_ENTRIES] Not authenticated')
      return { entries: [], totalCount: 0, page: 1, limit: 50, error: "Not authenticated" }
    }

    const { page = 1, limit = 50 } = options
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await supabase
      .from('entries')
      .select(`
        *,
        party:parties(name)
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('[GET_ALL_ENTRIES] Query error:', error)
      Sentry.captureException(error, { tags: { action: 'get-all-entries' } })
      return { entries: [], totalCount: 0, page, limit, error: "Something went wrong. Please try again." }
    }

    return { entries: data as Entry[], totalCount: count || 0, page, limit, error: null }
  } catch (error) {
    console.error('[GET_ALL_ENTRIES] Unexpected error:', error)
    Sentry.captureException(error, { tags: { action: 'get-all-entries' } })
    return { entries: [], totalCount: 0, page: 1, limit: 50, error: "Something went wrong. Please try again." }
  }
}

/**
 * Fetch recent entries for the home page dashboard.
 * Returns last 30 days of entries, capped at 100 rows.
 * Sufficient for Donna's insights and business card summaries.
 */
export async function getRecentEntries() {
  try {
    const supabase = await createSupabaseServerClient()
    const { user } = await getOrRefreshUser(supabase)

    if (!user) {
      console.error('[GET_RECENT_ENTRIES] Not authenticated')
      return { entries: [], error: "Not authenticated" }
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const startDate = thirtyDaysAgo.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('entries')
      .select(`
        *,
        party:parties(name)
      `)
      .eq('user_id', user.id)
      .gte('entry_date', startDate)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[GET_RECENT_ENTRIES] Query error:', error)
      Sentry.captureException(error, { tags: { action: 'get-recent-entries' } })
      return { entries: [], error: "Something went wrong. Please try again." }
    }

    return { entries: data as Entry[], error: null }
  } catch (error) {
    console.error('[GET_RECENT_ENTRIES] Unexpected error:', error)
    Sentry.captureException(error, { tags: { action: 'get-recent-entries' } })
    return { entries: [], error: "Something went wrong. Please try again." }
  }
}

/**
 * Fetch entries within a specific date range.
 * Used by CashPulse and ProfitLens analytics.
 * Safety cap at 5000 rows — consider a monthly_summaries table for scale.
 */
export async function getEntriesByDateRange(startDate: string, endDate: string) {
  try {
    const supabase = await createSupabaseServerClient()
    const { user } = await getOrRefreshUser(supabase)

    if (!user) {
      console.error('[GET_ENTRIES_BY_DATE_RANGE] Not authenticated')
      return { entries: [], error: "Not authenticated" }
    }

    const { data, error } = await supabase
      .from('entries')
      .select(`
        *,
        party:parties(name)
      `)
      .eq('user_id', user.id)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: false })
      .limit(5000) // Safety cap — consider monthly_summaries table for scale

    if (error) {
      console.error('[GET_ENTRIES_BY_DATE_RANGE] Query error:', error)
      Sentry.captureException(error, { tags: { action: 'get-entries-by-date-range' } })
      return { entries: [], error: "Something went wrong. Please try again." }
    }

    return { entries: data as Entry[], error: null }
  } catch (error) {
    console.error('[GET_ENTRIES_BY_DATE_RANGE] Unexpected error:', error)
    Sentry.captureException(error, { tags: { action: 'get-entries-by-date-range' } })
    return { entries: [], error: "Something went wrong. Please try again." }
  }
}

/**
 * Fetch entries for analytics pages (CashPulse, ProfitLens).
 * Defaults to last 90 days with a hard 5000-row safety cap.
 * Same return shape as getEntriesByDateRange().
 */
export async function getEntriesForAnalytics(startDateOverride?: string) {
  try {
    const supabase = await createSupabaseServerClient()
    const { user } = await getOrRefreshUser(supabase)

    if (!user) {
      console.error('[GET_ENTRIES_FOR_ANALYTICS] Not authenticated')
      return { entries: [], error: "Not authenticated" }
    }

    let startDate: string
    if (startDateOverride) {
      startDate = startDateOverride
    } else {
      // Default: fetch last 2 years of data to cover all period filters
      const twoYearsAgo = new Date()
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
      startDate = twoYearsAgo.toISOString().split('T')[0]
    }

    const { data, error } = await supabase
      .from('entries')
      .select(`
        *,
        party:parties(name)
      `)
      .eq('user_id', user.id)
      .gte('entry_date', startDate)
      .order('entry_date', { ascending: false })
      .limit(5000)

    if (error) {
      console.error('[GET_ENTRIES_FOR_ANALYTICS] Query error:', error)
      Sentry.captureException(error, { tags: { action: 'get-entries-for-analytics' } })
      return { entries: [], error: "Something went wrong. Please try again." }
    }

    return { entries: data as Entry[], error: null }
  } catch (error) {
    console.error('[GET_ENTRIES_FOR_ANALYTICS] Unexpected error:', error)
    Sentry.captureException(error, { tags: { action: 'get-entries-for-analytics' } })
    return { entries: [], error: "Something went wrong. Please try again." }
  }
}

export async function getCategories() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getOrRefreshUser(supabase)

  if (!user) {
    return { categories: [], error: "Not authenticated" }
  }

  // Return hardcoded categories with default styling
  // This ensures the form always works even without DB seeding
  const categories: Category[] = [
    {
      id: 'cat-sales',
      user_id: user.id,
      name: 'Sales',
      type: 'income',
      color: '#10b981',
      icon: 'TrendingUp',
      created_at: new Date().toISOString()
    },
    {
      id: 'cat-cogs',
      user_id: user.id,
      name: 'COGS',
      type: 'expense',
      color: '#ef4444',
      icon: 'ShoppingCart',
      created_at: new Date().toISOString()
    },
    {
      id: 'cat-opex',
      user_id: user.id,
      name: 'Opex',
      type: 'expense',
      color: '#f59e0b',
      icon: 'Briefcase',
      created_at: new Date().toISOString()
    },
    {
      id: 'cat-assets',
      user_id: user.id,
      name: 'Assets',
      type: 'expense',
      color: '#8b5cf6',
      icon: 'Package',
      created_at: new Date().toISOString()
    }
  ]

  return { categories, error: null }
}

export async function createEntry(input: CreateEntryInput) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getOrRefreshUser(supabase)

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  // Rate limiting: 100 entries per day per user (using Vercel KV)
  try {
    await checkRateLimit(user.id, 'create-entry')
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { success: false, error: error.message }
    }
    // If rate limit check fails (e.g., KV down), allow the request
    console.error('Rate limit check failed:', error)
    Sentry.captureException(error, {
      tags: { action: 'create-entry-rate-limit', userId: user.id },
      level: 'warning',
    })
  }

  // Sanitize inputs
  const sanitizedData = {
    entry_type: input.entry_type,
    category: input.category,
    amount: sanitizeAmount(input.amount),
    entry_date: sanitizeDate(input.entry_date),
    payment_method: input.payment_method || 'Cash',
    party_id: input.party_id || null,
    notes: input.notes ? sanitizeString(input.notes, 1000) : undefined,
    settled: input.settled || false,
    image_url: input.image_url,
  }

  // Comprehensive validation
  const validation = validateEntry(sanitizedData)
  if (!validation.isValid) {
    console.error('Validation failed:', validation.error)
    return { success: false, error: validation.error }
  }

  const payload = {
    user_id: user.id,
    entry_type: sanitizedData.entry_type,
    category: sanitizedData.category,
    amount: sanitizedData.amount,
    entry_date: sanitizedData.entry_date,
    payment_method: sanitizedData.payment_method,
    party_id: sanitizedData.party_id,
    notes: sanitizedData.notes || null,
    settled: sanitizedData.settled,
    image_url: sanitizedData.image_url || null,
  }

  const { error } = await supabase
    .from('entries')
    .insert(payload)

  if (error) {
    console.error('Failed to create entry:', error)
    Sentry.captureException(error, {
      tags: { action: 'create-entry', userId: user.id },
      extra: { entryData: sanitizedData },
      level: 'error',
    })
    return { success: false, error: "Something went wrong. Please try again." }
  }

  // Update running balance (fast, no table scan)
  const newBalance = await updateRunningBalance(
    supabase,
    user.id,
    sanitizedData.entry_type,
    sanitizedData.category,
    sanitizedData.amount,
    'create'
  )

  // Generate alerts using the balance we just calculated (no extra query needed)
  await generateAlertsForEntry(supabase, user.id, sanitizedData, newBalance)

  // Invalidate Donna's cached insights so next home page load gets fresh insights
  try {
    await supabase
      .from('profiles')
      .update({ insights_cache_date: null })
      .eq('user_id', user.id)
  } catch {
    // Non-critical, ignore
  }

  revalidatePath('/entries')
  revalidatePath('/analytics/cashpulse')
  revalidatePath('/analytics/profitlens')
  revalidatePath('/home')

  return { success: true, error: null }
}

export async function updateEntry(id: string, input: UpdateEntryInput) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getOrRefreshUser(supabase)

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  // Rate limiting: 200 updates per hour per user (using Vercel KV)
  try {
    await checkRateLimit(user.id, 'update-entry')
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { success: false, error: error.message }
    }
    console.error('Rate limit check failed:', error)
    Sentry.captureException(error, {
      tags: { action: 'update-entry-rate-limit', userId: user.id },
      level: 'warning',
    })
  }

  // Sanitize inputs
  const payload: Record<string, unknown> = {}

  if (input.entry_type) {
    payload.entry_type = input.entry_type
  }

  if (input.category) {
    payload.category = input.category
  }

  if (input.amount !== undefined) {
    payload.amount = sanitizeAmount(input.amount)
  }

  if (input.entry_date) {
    payload.entry_date = sanitizeDate(input.entry_date)
  }

  if (input.payment_method !== undefined) {
    payload.payment_method = input.payment_method
  }

  if (input.notes !== undefined) {
    payload.notes = input.notes ? sanitizeString(input.notes, 1000) : null
  }

  if (input.settled !== undefined) {
    payload.settled = input.settled
  }

  if (input.image_url !== undefined) {
    payload.image_url = input.image_url || null
  }

  // Fetch current entry for validation and balance tracking
  const { data: currentEntry } = await supabase
    .from('entries')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  // Validate the update data (if we have enough fields)
  if (Object.keys(payload).length > 0 && currentEntry) {
    const mergedData = { ...currentEntry, ...payload }
    const validation = validateEntry(mergedData)
    if (!validation.isValid) {
      console.error('Validation failed:', validation.error)
      return { success: false, error: validation.error }
    }
  }

  const { error } = await supabase
    .from('entries')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to update entry:', error)
    Sentry.captureException(error, {
      tags: { action: 'update-entry', userId: user.id, entryId: id },
      extra: { updateData: payload },
      level: 'error',
    })
    return { success: false, error: "Something went wrong. Please try again." }
  }

  // Update running balance if entry_type, category, or amount changed
  if (currentEntry && (payload.entry_type || payload.category || payload.amount !== undefined)) {
    const newType = (payload.entry_type || currentEntry.entry_type) as string
    const newCategory = (payload.category || currentEntry.category) as string
    const newAmount = (payload.amount !== undefined ? payload.amount : currentEntry.amount) as number

    await updateRunningBalance(
      supabase,
      user.id,
      newType,
      newCategory,
      newAmount,
      'update',
      {
        entry_type: currentEntry.entry_type,
        category: currentEntry.category,
        amount: currentEntry.amount,
      }
    )
  }

  // Invalidate Donna's cached insights
  try {
    await supabase
      .from('profiles')
      .update({ insights_cache_date: null })
      .eq('user_id', user.id)
  } catch {
    // Non-critical
  }

  revalidatePath('/entries')
  revalidatePath('/analytics/cashpulse')
  revalidatePath('/analytics/profitlens')
  revalidatePath('/home')

  return { success: true, error: null }
}

/**
 * Deletes an entry and reverses ALL impacts on dashboards.
 *
 * For settled Credit entries:
 * - Deletes the original Credit entry
 * - Also deletes the Cash IN/OUT settlement entry that was created
 * - Reverses impacts on: Cash Pulse, Profit Lens, Pending boxes, Settlement History
 *
 * For settled Advance entries:
 * - Deletes the original Advance entry
 * - No settlement entry to delete (Advance doesn't create new entry on settlement)
 * - Reverses impacts on: Cash Pulse, Profit Lens, Advance boxes, Settlement History
 *
 * For unsettled entries:
 * - Simply deletes the entry
 * - Reverses impacts on: Cash Pulse (for Cash/Advance), Profit Lens, Pending boxes
 */
export async function deleteEntry(id: string) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getOrRefreshUser(supabase)

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  // Rate limiting: 20 deletions per minute per user
  try {
    await checkRateLimit(user.id, 'entry-delete')
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { success: false, error: "Too many requests. Please try again shortly." }
    }
    console.warn('Rate limit check failed:', error)
  }

  // First, get the entry to check if it's settled and its type
  const { data: entry, error: fetchError } = await supabase
    .from('entries')
    .select('id, user_id, entry_type, category, settled, amount')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !entry) {
    console.error('Failed to fetch entry for deletion:', fetchError)
    if (fetchError) {
      Sentry.captureException(fetchError, {
        tags: { action: 'delete-entry-fetch', userId: user.id, entryId: id },
        level: 'error',
      })
    }
    return { success: false, error: 'Entry not found or no longer accessible' }
  }

  // If entry is settled, we need to handle associated settlement entries
  if (entry.settled) {
    // For Credit entries, delete the Cash IN/OUT settlement entry
    if (entry.entry_type === 'Credit') {
      // Find and delete the settlement Cash entry
      // It will have notes like "Settlement of credit sales (original_entry_id)"
      const settlementNotePattern = `Settlement of credit ${entry.category.toLowerCase()} (${id})`;

      const { error: deleteSettlementError } = await supabase
        .from('entries')
        .delete()
        .eq('user_id', user.id)
        .eq('notes', settlementNotePattern);

      if (deleteSettlementError) {
        console.error('Failed to delete settlement entry:', deleteSettlementError)
        Sentry.captureException(deleteSettlementError, {
          tags: { action: 'delete-entry-settlement', userId: user.id, entryId: id },
          extra: { entryType: entry.entry_type, category: entry.category },
          level: 'warning',
        })
        // Continue anyway - we'll still delete the original entry
      }
    }
    // For Advance entries, no settlement entry to delete (just marks as settled)
    // So we only need to delete the original entry
  }

  // Now delete the original entry
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to delete entry:', error)
    Sentry.captureException(error, {
      tags: { action: 'delete-entry', userId: user.id, entryId: id },
      extra: { entryType: entry.entry_type, settled: entry.settled },
      level: 'error',
    })
    return { success: false, error: "Something went wrong. Please try again." }
  }

  // Reverse the deleted entry's effect on the running balance
  await updateRunningBalance(
    supabase,
    user.id,
    entry.entry_type,
    entry.category,
    entry.amount,
    'delete'
  )

  // Invalidate Donna's cached insights
  try {
    await supabase
      .from('profiles')
      .update({ insights_cache_date: null })
      .eq('user_id', user.id)
  } catch {
    // Non-critical
  }

  revalidatePath('/entries')
  revalidatePath('/analytics/cashpulse')
  revalidatePath('/analytics/profitlens')
  revalidatePath('/home')

  return { success: true, error: null }
}
