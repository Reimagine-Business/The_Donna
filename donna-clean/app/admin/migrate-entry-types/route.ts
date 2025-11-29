import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/utils/supabase/server'

/**
 * Admin API endpoint to migrate entry types
 * POST /admin/migrate-entry-types
 */
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient()

    console.log('Starting entry type migration...')

    // Get current counts BEFORE migration
    const { count: beforeInflowCount } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('entry_type', 'Cash Inflow')

    const { count: beforeOutflowCount } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('entry_type', 'Cash Outflow')

    console.log(`BEFORE: Cash Inflow entries: ${beforeInflowCount || 0}`)
    console.log(`BEFORE: Cash Outflow entries: ${beforeOutflowCount || 0}`)

    // Update 'Cash Inflow' to 'Cash IN'
    const { data: inflowData, error: inflowError } = await supabase
      .from('entries')
      .update({ entry_type: 'Cash IN' })
      .eq('entry_type', 'Cash Inflow')
      .select('id')

    if (inflowError) {
      console.error('Error updating Cash Inflow entries:', inflowError)
      return NextResponse.json(
        { error: 'Failed to update Cash Inflow entries', details: inflowError },
        { status: 500 }
      )
    }

    console.log(`✓ Updated ${inflowData?.length || 0} Cash Inflow entries to Cash IN`)

    // Update 'Cash Outflow' to 'Cash OUT'
    const { data: outflowData, error: outflowError } = await supabase
      .from('entries')
      .update({ entry_type: 'Cash OUT' })
      .eq('entry_type', 'Cash Outflow')
      .select('id')

    if (outflowError) {
      console.error('Error updating Cash Outflow entries:', outflowError)
      return NextResponse.json(
        { error: 'Failed to update Cash Outflow entries', details: outflowError },
        { status: 500 }
      )
    }

    console.log(`✓ Updated ${outflowData?.length || 0} Cash Outflow entries to Cash OUT`)

    // Get counts AFTER migration
    const { count: afterCashInCount } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('entry_type', 'Cash IN')

    const { count: afterCashOutCount } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('entry_type', 'Cash OUT')

    const { count: creditCount } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('entry_type', 'Credit')

    const { count: advanceCount } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('entry_type', 'Advance')

    // Check for any remaining old entries
    const { count: remainingInflowCount } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('entry_type', 'Cash Inflow')

    const { count: remainingOutflowCount } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('entry_type', 'Cash Outflow')

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      results: {
        before: {
          cashInflow: beforeInflowCount || 0,
          cashOutflow: beforeOutflowCount || 0
        },
        updated: {
          cashIn: inflowData?.length || 0,
          cashOut: outflowData?.length || 0
        },
        after: {
          cashIN: afterCashInCount || 0,
          cashOUT: afterCashOutCount || 0,
          credit: creditCount || 0,
          advance: advanceCount || 0
        },
        remaining: {
          oldCashInflow: remainingInflowCount || 0,
          oldCashOutflow: remainingOutflowCount || 0
        }
      }
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
