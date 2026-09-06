'use client'

import { useEffect, useRef, useState } from 'react'

export const WAVEFORM_SLOT_COUNT = 72
export const BAR_MIN_HEIGHT = 3
export const BAR_MAX_HEIGHT = 26
export const SLOT_PITCH = 6
export function waveformBarHeight(level: number): number {
  const clamped = Math.min(1, Math.max(0, level))

  return BAR_MIN_HEIGHT + (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT) * clamped
}

const FADE_IN_SLOTS = 4
const MIN_BAR_OPACITY = 0.35

function barOpacity(distanceFromNewest: number): number {
  return Math.min(1, Math.max(MIN_BAR_OPACITY, distanceFromNewest / FADE_IN_SLOTS))
}

interface WaveformTrackProps {
  readonly levels: readonly number[]
  readonly slotCount?: number
}

export function WaveformTrack({ levels, slotCount = WAVEFORM_SLOT_COUNT }: WaveformTrackProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const [railWidth, setRailWidth] = useState(0)

  useEffect(() => {
    const rail = railRef.current

    if (rail === null || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (entry === undefined) return

      setRailWidth(entry.contentRect.width)
    })

    observer.observe(rail)

    return () => {
      observer.disconnect()
    }
  }, [])
  const visibleSlotCount =
    railWidth === 0 ? slotCount : Math.min(slotCount, Math.floor(railWidth / SLOT_PITCH))
  const bars = visibleSlotCount === 0 ? [] : levels.slice(-visibleSlotCount)
  const dotCount = Math.max(0, visibleSlotCount - bars.length)

  return (
    <div
      aria-hidden="true"
      className="flex h-7 min-w-0 flex-1 items-center justify-between overflow-hidden"
      ref={railRef}
    >
      {Array.from({ length: dotCount }, (_, index) => (
        <span
          className="size-[3px] shrink-0 rounded-full bg-border"
          data-waveform="dot"
          key={`dot-${String(index)}`}
        />
      ))}
      {bars.map((level, index) => (
        <span
          className="w-[3px] shrink-0 rounded-full bg-text-muted"
          data-waveform="bar"
          key={`bar-${String(index)}`}
          style={{
            height: `${String(waveformBarHeight(level))}px`,
            opacity: barOpacity(bars.length - index),
          }}
        />
      ))}
    </div>
  )
}
