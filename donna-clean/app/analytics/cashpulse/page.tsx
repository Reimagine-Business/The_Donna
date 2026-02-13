import { Suspense } from 'react'
import { getEntriesByDateRange } from '@/app/entries/actions'
import { getSettlementHistory } from '@/app/settlements/settlement-history-actions'
import { CashPulseAnalytics } from '@/components/analytics/cash-pulse-analytics'
import { EntryListSkeleton } from '@/components/skeletons/entry-skeleton'
import { SiteHeader } from '@/components/site-header'
import { TopNavMobile } from '@/components/navigation/top-nav-mobile'
import { BottomNav } from '@/components/navigation/bottom-nav'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CashPulseAnalyticsPage() {
  // Load 2 years of data (covers This Month, Last Month, This Year, Last Year presets)
  const now = new Date()
  const startDate = `${now.getFullYear() - 1}-01-01`
  const endDate = now.toISOString().split('T')[0]
  const { entries } = await getEntriesByDateRange(startDate, endDate)
  const { settlementHistory } = await getSettlementHistory()

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e] text-white pb-24 md:pb-8">
      <div className="flex flex-col min-h-screen">
        <SiteHeader />
        <TopNavMobile />

        <section className="flex-1 px-4 py-4 md:px-8 overflow-auto">
          <div className="mx-auto w-full max-w-6xl">
            <Suspense fallback={<EntryListSkeleton />}>
              <CashPulseAnalytics entries={entries} settlementHistory={settlementHistory} />
            </Suspense>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  )
}
