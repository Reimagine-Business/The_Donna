'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Download, RefreshCw } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { type Entry } from '@/app/entries/actions'
import {
  calculateCashBalance,
  getTotalCashIn,
  getTotalCashOut,
  getMonthlyComparison,
  getEntryCount,
} from '@/lib/analytics-new'
import { showSuccess } from '@/lib/toast'

interface CashPulseAnalyticsProps {
  entries: Entry[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatCurrencyLakhs(amount: number): string {
  const absAmount = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''

  if (absAmount >= 10000000) {
    const crores = absAmount / 10000000
    return `${sign}₹${crores.toFixed(2)} Cr`
  } else if (absAmount >= 100000) {
    const lakhs = absAmount / 100000
    return `${sign}₹${lakhs.toFixed(2)} L`
  } else {
    return formatCurrency(amount)
  }
}

export function CashPulseAnalytics({ entries }: CashPulseAnalyticsProps) {
  const router = useRouter()
  const [dateRange, setDateRange] = useState<'month' | '3months' | 'year'>('month')
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    router.refresh()
  }, [router])

  const { startDate, endDate } = useMemo(() => {
    const end = endOfMonth(new Date())
    let start = startOfMonth(new Date())

    if (dateRange === '3months') {
      start = startOfMonth(subMonths(new Date(), 2))
    } else if (dateRange === 'year') {
      start = startOfMonth(subMonths(new Date(), 11))
    }

    return { startDate: start, endDate: end }
  }, [dateRange])

  const cashBalance = useMemo(() => calculateCashBalance(entries), [entries])
  const totalCashIn = useMemo(() => getTotalCashIn(entries, startDate, endDate), [entries, startDate, endDate])
  const totalCashOut = useMemo(() => getTotalCashOut(entries, startDate, endDate), [entries, startDate, endDate])
  const monthlyComparison = useMemo(() => getMonthlyComparison(entries), [entries])
  const cashInCount = useMemo(() => getEntryCount(entries, 'in', startDate, endDate), [entries, startDate, endDate])
  const cashOutCount = useMemo(() => getEntryCount(entries, 'out', startDate, endDate), [entries, startDate, endDate])

  // Calculate Cash vs Bank breakdown
  const { cashAmount, bankAmount } = useMemo(() => {
    const cash = entries
      .filter(e => e.payment_method === 'Cash')
      .reduce((sum, e) => {
        if (e.entry_type === 'Cash IN' || (e.entry_type === 'Advance' && e.category === 'Sales')) {
          return sum + e.amount
        } else if (e.entry_type === 'Cash OUT' || (e.entry_type === 'Advance' && ['COGS', 'Opex', 'Assets'].includes(e.category))) {
          return sum - e.amount
        }
        return sum
      }, 0)

    const bank = entries
      .filter(e => e.payment_method === 'Bank')
      .reduce((sum, e) => {
        if (e.entry_type === 'Cash IN' || (e.entry_type === 'Advance' && e.category === 'Sales')) {
          return sum + e.amount
        } else if (e.entry_type === 'Cash OUT' || (e.entry_type === 'Advance' && ['COGS', 'Opex', 'Assets'].includes(e.category))) {
          return sum - e.amount
        }
        return sum
      }, 0)

    return { cashAmount: cash, bankAmount: bank }
  }, [entries])

  // Calculate percentages for breakdown
  const totalPayment = cashAmount + bankAmount
  const cashPercentage = totalPayment > 0 ? (cashAmount / totalPayment) * 100 : 0
  const bankPercentage = totalPayment > 0 ? (bankAmount / totalPayment) * 100 : 0

  const handleRefresh = async () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => {
      setIsRefreshing(false)
      showSuccess('Data refreshed!')
    }, 500)
  }

  const handleExportCSV = () => {
    const csvContent = [
      ['Date', 'Entry Type', 'Category', 'Amount', 'Payment Method', 'Notes'].join(','),
      ...entries.map(entry =>
        [
          entry.entry_date,
          entry.entry_type,
          entry.category,
          entry.amount,
          entry.payment_method || '',
          `"${(entry.notes || '').replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cashpulse-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    showSuccess('Exported to CSV successfully!')
  }

  return (
    <div className="space-y-3">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cash Pulse</h1>
          <p className="text-purple-300 text-xs mt-0.5">Cash flow tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-purple-900/50 hover:bg-purple-900/70 text-white rounded-lg transition-colors disabled:opacity-50"
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            aria-label="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-2">
        <label className="text-purple-300 text-xs">Period:</label>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as 'month' | '3months' | 'year')}
          className="px-3 py-1.5 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="month">This Month</option>
          <option value="3months">Last 3 Months</option>
          <option value="year">This Year</option>
        </select>
      </div>

      {/* Total Cash Balance */}
      <div className="bg-gradient-to-br from-purple-900/60 to-purple-800/60 border-2 border-purple-500/40 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-5 h-5 text-purple-300" />
          <span className="text-xs text-purple-300 uppercase tracking-wider font-medium">Total Cash Balance</span>
        </div>
        <div className="text-4xl font-bold text-white mb-1">
          {formatCurrencyLakhs(cashBalance)}
        </div>
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1 text-sm ${cashBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {cashBalance >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="font-semibold">{cashBalance >= 0 ? 'Positive' : 'Negative'}</span>
          </div>
          <span className="text-xs text-purple-400">As of {format(new Date(), 'dd MMM yyyy')}</span>
        </div>
      </div>

      {/* Cash IN and Cash OUT - Side by side */}
      <div className="grid grid-cols-2 gap-2">
        {/* Cash IN */}
        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border-2 border-green-500/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowUpRight className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-300 uppercase tracking-wider font-medium">Cash IN</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{formatCurrencyLakhs(totalCashIn)}</div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-green-200">{cashInCount} entries</span>
            {monthlyComparison.percentChange.cashIn !== 0 && (
              <span className={`text-xs flex items-center gap-0.5 font-semibold ${monthlyComparison.percentChange.cashIn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {monthlyComparison.percentChange.cashIn >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(monthlyComparison.percentChange.cashIn).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Cash OUT */}
        <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 border-2 border-red-500/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowDownRight className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-300 uppercase tracking-wider font-medium">Cash OUT</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{formatCurrencyLakhs(totalCashOut)}</div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-200">{cashOutCount} entries</span>
            {monthlyComparison.percentChange.cashOut !== 0 && (
              <span className={`text-xs flex items-center gap-0.5 font-semibold ${monthlyComparison.percentChange.cashOut >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                {monthlyComparison.percentChange.cashOut >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(monthlyComparison.percentChange.cashOut).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-3">
        <h3 className="text-sm font-semibold text-white mb-2">Payment Method Breakdown</h3>

        {/* Cash */}
        <div className="space-y-1 mb-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-purple-200">Cash</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{formatCurrency(cashAmount)}</span>
              <span className="text-xs text-purple-400">{cashPercentage.toFixed(1)}%</span>
            </div>
          </div>
          <div className="w-full bg-purple-900/30 rounded-full h-2">
            <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${cashPercentage}%` }}></div>
          </div>
        </div>

        {/* Bank */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-sm text-purple-200">Bank</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{formatCurrency(bankAmount)}</span>
              <span className="text-xs text-purple-400">{bankPercentage.toFixed(1)}%</span>
            </div>
          </div>
          <div className="w-full bg-purple-900/30 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${bankPercentage}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}
