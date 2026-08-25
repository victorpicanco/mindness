import { useEffect, useRef, useState } from 'react'

import { TIMER_TICK_MS } from './practice-countdown'

export const MAX_RECORDING_SECONDS = 60

export interface UseRecordingClockOptions {
  readonly isActive: boolean
  readonly limitSeconds?: number
  readonly onLimitReached: () => void
}

export function useRecordingClock({
  isActive,
  limitSeconds = MAX_RECORDING_SECONDS,
  onLimitReached,
}: UseRecordingClockOptions): number {
  const [seconds, setSeconds] = useState(0)
  const onLimitReachedRef = useRef(onLimitReached)

  useEffect(() => {
    onLimitReachedRef.current = onLimitReached
  })

  useEffect(() => {
    if (!isActive) return

    const startedAt = Date.now()

    function tick() {
      const elapsed = Math.floor((Date.now() - startedAt) / TIMER_TICK_MS)

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
  }, [isActive, limitSeconds])

  return seconds
}
