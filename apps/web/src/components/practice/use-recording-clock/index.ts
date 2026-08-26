import { useEffect, useRef, useState } from 'react'

import { TIMER_TICK_MS } from '@/components/practice/countdown'

export const MAX_RECORDING_SECONDS = 58

export interface UseRecordingClockOptions {
  readonly isActive: boolean
  readonly limitSeconds?: number
  readonly onLimitReached: () => void
  readonly serverTimeOffsetMs?: number
  readonly startedAt?: string
}

export function useRecordingClock({
  isActive,
  limitSeconds = MAX_RECORDING_SECONDS,
  onLimitReached,
  serverTimeOffsetMs = 0,
  startedAt,
}: UseRecordingClockOptions): number {
  const [seconds, setSeconds] = useState(0)
  const onLimitReachedRef = useRef(onLimitReached)

  useEffect(() => {
    onLimitReachedRef.current = onLimitReached
  })

  useEffect(() => {
    if (!isActive) return

    const recordingStartedAt =
      startedAt === undefined ? Date.now() + serverTimeOffsetMs : new Date(startedAt).getTime()

    function tick() {
      const elapsed = Math.floor(
        (Date.now() + serverTimeOffsetMs - recordingStartedAt) / TIMER_TICK_MS,
      )

      setSeconds(Math.min(limitSeconds, elapsed))

      if (elapsed < limitSeconds) return

      window.clearInterval(timer)
      onLimitReachedRef.current()
    }

    const timer = window.setInterval(tick, TIMER_TICK_MS)

    return () => {
      window.clearInterval(timer)
      setSeconds(0)
    }
  }, [isActive, limitSeconds, serverTimeOffsetMs, startedAt])

  return seconds
}
