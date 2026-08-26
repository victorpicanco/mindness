'use client'

import { useEffect } from 'react'

import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { countdownSeconds, TIMER_TICK_MS } from '@/components/practice/countdown'

interface UseSessionDeadlineOptions {
  readonly onExpired: () => void
}

const EXPIRABLE_STATUSES = new Set(['awaiting-recording', 'recording', 'uploading'])

export function useSessionDeadline({ onExpired }: UseSessionDeadlineOptions) {
  const session = usePracticeSessionStore((state) => state.session)
  const status = usePracticeSessionStore((state) => state.status)
  const expireSession = usePracticeSessionStore((state) => state.expireSession)
  const serverTimeOffsetMs = usePracticeSessionStore((state) => state.serverTimeOffsetMs)
  const expiresAt = session?.expiresAt

  useEffect(() => {
    if (expiresAt === undefined || !EXPIRABLE_STATUSES.has(status)) return

    function checkExpiration() {
      if (expiresAt === undefined || countdownSeconds(expiresAt, serverTimeOffsetMs) !== 0) return

      expireSession()
      onExpired()
    }

    checkExpiration()
    const timer = window.setInterval(checkExpiration, TIMER_TICK_MS)

    return () => window.clearInterval(timer)
  }, [expireSession, expiresAt, onExpired, serverTimeOffsetMs, status])
}
