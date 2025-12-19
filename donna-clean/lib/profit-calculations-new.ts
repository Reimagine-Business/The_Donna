import { type Entry } from '@/lib/entries'
import { startOfMonth, endOfMonth, subMonths, format, eachMonthOfInterval } from 'date-fns'

export type ProfitMetrics = {
  revenue: number
  cogs: number
  grossProfit: number
  operatingExpenses: number
  netProfit: number
  profitMargin: number
}

export type ProfitTrendData = {
  month: string
  revenue: number
  expenses: number
  profit: number
  margin: number
}

export type CategoryExpense = {
  category: string
  amount: number
  percentage: number
}

// ═══════════════════════════════════════════════════════════
// PROFIT LENS LOGIC (Accrual-basis accounting)
// ═══════════════════════════════════════════════════════════
// Profit Lens tracks revenue and expenses when earned/incurred:
// - Revenue: Cash IN (Sales) + Credit (Sales) + Advance Settlement (Received)
// - COGS: Cash OUT (COGS) + Credit (COGS) + Advance Settlement (Paid, COGS)
// - OpEx: Cash OUT (Opex) + Credit (Opex) + Advance Settlement (Paid, Opex)
// - Original Advance entries do NOT affect Profit Lens (not yet earned/incurred)
// - Assets do NOT affect Profit Lens (not an expense)
//
// Settlement Logic (NEW):
// - Credit settlements: Create Cash IN/OUT entries (affect Cash Pulse, NOT Profit)
// - Advance settlements: Create settlement entries with payment_method='None'
//   → These affect Profit Lens (revenue/expense recognition)
//   → Do NOT affect Cash Pulse (cash already counted at creation)
// ═══════════════════════════════════════════════════════════

// Calculate Revenue (Total Sales) for Profit Lens
// RULES:
// 1. Cash IN Sales (excluding Credit settlements)
// 2. ALL Credit Sales (both settled AND unsettled) - recognized immediately
// 3. Advance Settlement (Received) - revenue recognized when work completed
// 4. Original Advance Sales - NOT counted (revenue recognized at settlement)
export function calculateRevenue(entries: Entry[], startDate?: Date, endDate?: Date): number {
  let total = 0
  let counted = 0
  let skipped = 0

  for (const entry of entries) {
    // Only process Sales category
    if (entry.category !== 'Sales') {
      continue
    }

    // Apply date filters if provided
    if (startDate && new Date(entry.entry_date) < startDate) {
      skipped++
      continue
    }
    if (endDate && new Date(entry.entry_date) > endDate) {
      skipped++
      continue
    }

    // RULE 1: Cash IN Sales (excluding Credit Settlement entries)
    if (entry.entry_type === 'Cash IN') {
      // Exclude Credit settlements (these are for Cash Pulse, not Profit)
      if (entry.is_settlement && entry.settlement_type === 'credit') {
        skipped++
      } else {
        total += entry.amount
        counted++
      }
      continue
    }

    // RULE 2: ALL Credit Sales (BOTH settled AND unsettled)
    // Credit recognized immediately when invoiced
    if (entry.entry_type === 'Credit') {
      total += entry.amount
      counted++
      continue
    }

    // RULE 3: ✅ NEW - Advance Settlement (Received)
    // Revenue recognized when work is completed (settlement date)
    if (entry.entry_type === 'Advance Settlement (Received)') {
      total += entry.amount
      counted++
      continue
    }

    // RULE 4: ❌ Original Advance Sales - NOT counted
    // Revenue will be counted when settlement entry is created
    if (entry.entry_type === 'Advance') {
      skipped++
      continue
    }

    // Unknown entry type
    skipped++
  }

  return total
}

// Calculate COGS (Cost of Goods Sold from Cash OUT + Credit + Advance Settlement)
export function calculateCOGS(entries: Entry[], startDate?: Date, endDate?: Date): number {
  let filtered = entries.filter(e =>
    e.category === 'COGS' &&
    (
      // Cash OUT COGS (excluding Credit settlements)
      (e.entry_type === 'Cash OUT' && !(e.is_settlement && e.settlement_type === 'credit')) ||
      // All Credit COGS (recognized immediately)
      e.entry_type === 'Credit' ||
      // ✅ NEW - Advance Settlement (Paid) for COGS - expense recognized at settlement
      e.entry_type === 'Advance Settlement (Paid)'
      // ❌ Original Advance COGS - NOT counted (will be counted at settlement)
    )
  )

  if (startDate) {
    filtered = filtered.filter(e => new Date(e.entry_date) >= startDate)
  }
  if (endDate) {
    filtered = filtered.filter(e => new Date(e.entry_date) <= endDate)
  }

  const total = filtered.reduce((sum, e) => sum + e.amount, 0)

  return total
}

// Calculate Gross Profit
export function calculateGrossProfit(revenue: number, cogs: number): number {
  return revenue - cogs
}

// Calculate Operating Expenses (Opex from Cash OUT + Credit + Advance Settlement, NO Assets)
export function calculateOperatingExpenses(entries: Entry[], startDate?: Date, endDate?: Date): number {
  let filtered = entries.filter(e =>
    e.category === 'Opex' &&
    (
      // Cash OUT Opex (excluding Credit settlements)
      (e.entry_type === 'Cash OUT' && !(e.is_settlement && e.settlement_type === 'credit')) ||
      // All Credit Opex (recognized immediately)
      e.entry_type === 'Credit' ||
      // ✅ NEW - Advance Settlement (Paid) for Opex - expense recognized at settlement
      e.entry_type === 'Advance Settlement (Paid)'
      // ❌ Original Advance Opex - NOT counted (will be counted at settlement)
    )
  )

  if (startDate) {
    filtered = filtered.filter(e => new Date(e.entry_date) >= startDate)
  }
  if (endDate) {
    filtered = filtered.filter(e => new Date(e.entry_date) <= endDate)
  }

  const total = filtered.reduce((sum, e) => sum + e.amount, 0)

  return total
}

// Calculate Net Profit
export function calculateNetProfit(grossProfit: number, operatingExpenses: number): number {
  return grossProfit - operatingExpenses
}

// Calculate Profit Margin
export function calculateProfitMargin(netProfit: number, revenue: number): number {
  return revenue > 0 ? (netProfit / revenue) * 100 : 0
}

// Get all profit metrics for a period
export function getProfitMetrics(entries: Entry[], startDate?: Date, endDate?: Date): ProfitMetrics {
  const revenue = calculateRevenue(entries, startDate, endDate)
  const cogs = calculateCOGS(entries, startDate, endDate)
  const grossProfit = calculateGrossProfit(revenue, cogs)
  const operatingExpenses = calculateOperatingExpenses(entries, startDate, endDate)
  const netProfit = calculateNetProfit(grossProfit, operatingExpenses)
  const profitMargin = calculateProfitMargin(netProfit, revenue)

  return {
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    netProfit,
    profitMargin,
  }
}

// Get profit trend over last N months
export function getProfitTrend(entries: Entry[], months: number = 6): ProfitTrendData[] {
  const endDate = endOfMonth(new Date())
  const startDate = startOfMonth(subMonths(new Date(), months - 1))

  const monthRange = eachMonthOfInterval({ start: startDate, end: endDate })

  return monthRange.map(monthStart => {
    const monthEnd = endOfMonth(monthStart)

    const revenue = calculateRevenue(entries, monthStart, monthEnd)

    // Total expenses = COGS + Opex
    const totalExpenses = entries
      .filter(e =>
        ['COGS', 'Opex'].includes(e.category) &&
        (
          // Cash OUT (excluding Credit settlements)
          (e.entry_type === 'Cash OUT' && !(e.is_settlement && e.settlement_type === 'credit')) ||
          // All Credit (recognized immediately)
          e.entry_type === 'Credit' ||
          // ✅ Advance Settlement (Paid) - expense recognized at settlement
          e.entry_type === 'Advance Settlement (Paid)'
          // ❌ Original Advance - NOT counted
        )
      )
      .filter(e => {
        const entryDate = new Date(e.entry_date)
        return entryDate >= monthStart && entryDate <= monthEnd
      })
      .reduce((sum, e) => sum + e.amount, 0)

    const profit = revenue - totalExpenses
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0

    return {
      month: format(monthStart, 'MMM yyyy'),
      revenue,
      expenses: totalExpenses,
      profit,
      margin,
    }
  })
}

// Get expense breakdown by category with percentages (COGS + Opex only, NO Sales, NO Assets)
export function getExpenseBreakdown(entries: Entry[], startDate?: Date, endDate?: Date): CategoryExpense[] {
  // Only include COGS and Opex, NEVER Sales or Assets
  let filtered = entries.filter(e =>
    ['COGS', 'Opex'].includes(e.category) &&
    (
      // Cash OUT (excluding Credit settlements)
      (e.entry_type === 'Cash OUT' && !(e.is_settlement && e.settlement_type === 'credit')) ||
      // All Credit (recognized immediately)
      e.entry_type === 'Credit' ||
      // ✅ Advance Settlement (Paid) - expense recognized at settlement
      e.entry_type === 'Advance Settlement (Paid)'
      // ❌ Original Advance - NOT counted
    )
  )

  if (startDate) {
    filtered = filtered.filter(e => new Date(e.entry_date) >= startDate)
  }
  if (endDate) {
    filtered = filtered.filter(e => new Date(e.entry_date) <= endDate)
  }

  const categoryMap = new Map<string, number>()

  filtered.forEach(entry => {
    const existing = categoryMap.get(entry.category) || 0
    categoryMap.set(entry.category, existing + entry.amount)
  })

  const total = Array.from(categoryMap.values()).reduce((sum, amount) => sum + amount, 0)

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

// Generate insights and recommendations based on data
export function getRecommendations(entries: Entry[], startDate?: Date, endDate?: Date): string[] {
  const recommendations: string[] = []
  const metrics = getProfitMetrics(entries, startDate, endDate)

  // COGS analysis
  if (metrics.revenue > 0) {
    const cogsPercentage = (metrics.cogs / metrics.revenue) * 100
    if (cogsPercentage > 50) {
      recommendations.push(
        `Your COGS is ${cogsPercentage.toFixed(1)}% of revenue (industry avg: 40-50%). Consider optimizing your supply chain or renegotiating with suppliers.`
      )
    } else if (cogsPercentage < 30) {
      recommendations.push(
        `Your COGS is ${cogsPercentage.toFixed(1)}% of revenue, which is excellent! You have strong margins.`
      )
    }
  }

  // Operating expenses analysis
  if (metrics.revenue > 0) {
    const opexPercentage = (metrics.operatingExpenses / metrics.revenue) * 100
    if (opexPercentage > 40) {
      recommendations.push(
        `Operating expenses are ${opexPercentage.toFixed(1)}% of revenue. Look for opportunities to reduce overhead costs.`
      )
    }
  }

  // Profit margin analysis
  if (metrics.profitMargin < 0) {
    recommendations.push(
      `You're currently running at a loss. Focus on increasing revenue or reducing expenses to reach break-even.`
    )
  } else if (metrics.profitMargin < 10) {
    recommendations.push(
      `Profit margin is ${metrics.profitMargin.toFixed(1)}%, which is low. Aim for at least 10-15% for healthy business growth.`
    )
  } else if (metrics.profitMargin > 20) {
    recommendations.push(
      `Excellent profit margin of ${metrics.profitMargin.toFixed(1)}%! Your business is performing very well.`
    )
  }

  // Top expense category
  const expenseBreakdown = getExpenseBreakdown(entries, startDate, endDate)
  if (expenseBreakdown.length > 0) {
    const topExpense = expenseBreakdown[0]
    recommendations.push(
      `Top expense category: ${topExpense.category} (₹${topExpense.amount.toLocaleString('en-IN')}, ${topExpense.percentage.toFixed(1)}% of total expenses)`
    )
  }

  // Trend analysis (compare to previous period)
  const currentMonthStart = startDate || startOfMonth(new Date())
  const currentMonthEnd = endDate || endOfMonth(new Date())
  const previousMonthStart = startOfMonth(subMonths(currentMonthStart, 1))
  const previousMonthEnd = endOfMonth(subMonths(currentMonthStart, 1))

  const currentMetrics = getProfitMetrics(entries, currentMonthStart, currentMonthEnd)
  const previousMetrics = getProfitMetrics(entries, previousMonthStart, previousMonthEnd)

  if (previousMetrics.profitMargin !== 0) {
    const marginChange = currentMetrics.profitMargin - previousMetrics.profitMargin
    if (marginChange > 5) {
      recommendations.push(`Profit margin improved by ${marginChange.toFixed(1)}% this month. Great work!`)
    } else if (marginChange < -5) {
      recommendations.push(
        `Profit margin declined by ${Math.abs(marginChange).toFixed(1)}% this month. Review recent changes in pricing or costs.`
      )
    }
  }

  if (previousMetrics.operatingExpenses > 0) {
    const opexChange = ((currentMetrics.operatingExpenses - previousMetrics.operatingExpenses) / previousMetrics.operatingExpenses) * 100
    if (opexChange > 20) {
      recommendations.push(
        `Operating expenses increased by ${opexChange.toFixed(1)}% this month. Investigate the cause of this spike.`
      )
    }
  }

  return recommendations
}
