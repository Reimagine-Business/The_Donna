'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type Profile = {
  business_name: string | null
  role: string | null
}

interface DashboardContentProps {
  /** Profile fetched server-side (null if server fetch failed) */
  serverProfile: Profile | null
  userEmail: string | null
  userId: string
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-9 w-64 mb-1" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36 mb-1" />
            <Skeleton className="h-4 w-44" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Skeleton className="h-4 w-28 mb-1" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div>
              <Skeleton className="h-4 w-16 mb-1" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div>
              <Skeleton className="h-4 w-16 mb-1" />
              <Skeleton className="h-5 w-48" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-1" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function DashboardContent({
  serverProfile,
  userEmail,
  userId,
}: DashboardContentProps) {
  const [profile, setProfile] = useState<Profile | null>(serverProfile)
  const [loading, setLoading] = useState(!serverProfile)
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    // If the server already fetched the profile, nothing to do
    if (serverProfile) return

    let cancelled = false

    async function fetchProfileWithRetry() {
      const maxRetries = 5

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (cancelled) return

        try {
          const { data, error: fetchError } = await supabase
            .from('profiles')
            .select('business_name, role')
            .eq('user_id', userId)
            .maybeSingle()

          if (fetchError && fetchError.code !== 'PGRST116') {
            // Real error — but keep retrying, session may not be ready yet
            if (attempt === maxRetries - 1) {
              throw fetchError
            }
          } else if (data) {
            if (!cancelled) {
              setProfile(data)
              setLoading(false)
            }
            return
          }
        } catch (err) {
          if (attempt === maxRetries - 1) {
            if (!cancelled) {
              setError(
                err instanceof Error ? err.message : 'Failed to load profile'
              )
              setLoading(false)
            }
            return
          }
        }

        // Exponential backoff: 500ms, 1000ms, 1500ms, 2000ms
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      }

      // All retries exhausted with no data (but no error either) —
      // try to create the profile
      if (cancelled) return

      try {
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            business_name: userEmail?.split('@')[0] ?? 'Not set',
            role: 'owner',
          })
          .select('business_name, role')
          .single()

        if (createError) {
          // Duplicate key — profile exists, fetch it
          if (createError.code === '23505') {
            const { data: existing } = await supabase
              .from('profiles')
              .select('business_name, role')
              .eq('user_id', userId)
              .single()

            if (!cancelled && existing) {
              setProfile(existing)
              setLoading(false)
              return
            }
          }
          if (!cancelled) {
            setError('Unable to load your profile. Please refresh the page.')
            setLoading(false)
          }
        } else if (!cancelled) {
          setProfile(created)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load your profile. Please refresh the page.')
          setLoading(false)
        }
      }
    }

    fetchProfileWithRetry()

    return () => {
      cancelled = true
    }
  }, [serverProfile, supabase, userId, userEmail])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <Card className="border-red-500/40 bg-red-500/10">
        <CardHeader>
          <CardTitle>Profile Error</CardTitle>
          <CardDescription>
            {error}. Please try refreshing the page or contact support if the
            issue persists.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <div>
        <p className="text-sm uppercase text-muted-foreground">Welcome back</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {profile?.business_name || 'Not set'}
        </h1>
        <p className="text-muted-foreground">{userEmail ?? 'No email'}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business profile</CardTitle>
            <CardDescription>Key information on file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <p className="text-muted-foreground">Business name</p>
              <p className="font-medium">
                {profile?.business_name || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Role</p>
              <p className="font-medium">{profile?.role || 'Not set'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{userEmail ?? 'Not set'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily check-ins</CardTitle>
            <CardDescription>
              Keep track of wins, blockers, and notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Add your first note on the{' '}
            <a className="underline" href="/entries">
              daily entries
            </a>{' '}
            page to build momentum.
          </CardContent>
        </Card>
      </div>
    </>
  )
}
