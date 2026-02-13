import { Suspense } from 'react'
import { getEntries, getCategories } from './actions'
import { EntriesShell } from '@/components/entries/entries-shell'
import { EntryListSkeleton } from '@/components/skeletons/entry-skeleton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EntriesPage() {
  // Default: page 1, 50 per page, this month's entries
  const now = new Date()
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [entriesResult, categoriesResult] = await Promise.all([
    getEntries({ page: 1, pageSize: 50, startDate }),
    getCategories(),
  ])

  return (
    <Suspense fallback={<EntryListSkeleton />}>
      <EntriesShell
        initialEntries={entriesResult.entries}
        initialTotalCount={entriesResult.totalCount}
        initialTotalPages={entriesResult.totalPages}
        categories={categoriesResult.categories}
        error={entriesResult.error || categoriesResult.error}
        showFormAtTop={true}
      />
    </Suspense>
  )
}
