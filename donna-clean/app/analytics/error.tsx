'use client'

import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [countdown, setCountdown] = useState(3)
  const [autoRetried, setAutoRetried] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    } else {
      console.error('Analytics error:', error);
    }
  }, [error])

  // Auto-retry once after 3 second countdown
  useEffect(() => {
    if (autoRetried) return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setAutoRetried(true)
          reset()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [autoRetried, reset])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">😔</div>
        <h2 className="text-2xl font-bold mb-2 text-white">Analytics Error</h2>
        <p className="text-white/60 mb-6">
          Something went wrong loading your analytics.
          {!autoRetried && (
            <span className="block mt-2 text-purple-400">
              Retrying in {countdown}...
            </span>
          )}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              setAutoRetried(false)
              setCountdown(3)
              reset()
            }}
            className="px-6 py-3 bg-[#8b5cf6] hover:bg-[#7c3aed] rounded-lg font-medium text-white transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/home'}
            className="px-6 py-3 bg-white/[0.08] hover:bg-white/[0.15] rounded-lg font-medium text-white transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  )
}
