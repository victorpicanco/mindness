import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/lib/ui/class-names'

import { waveformBarHeight } from '@/components/practice/waveform-track'

const PLAYBACK_SLOT_COUNT = 40

const MIN_PLAYBACK_LEVEL = 0.2
const FNV_OFFSET_BASIS = 2166136261
const FNV_PRIME = 16777619

// The stored recording is only fetched when playback starts, so its real amplitude envelope is not
// available while the message renders. The bars are derived from the recording identity instead:
// stable across renders and distinct per recording, which is what this waveform communicates.
export function playbackLevels(
  seed: string,
  slotCount: number = PLAYBACK_SLOT_COUNT,
): readonly number[] {
  let state = FNV_OFFSET_BASIS

  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), FNV_PRIME)
  }

  return Array.from({ length: slotCount }, (_, index) => {
    state = Math.imul(state ^ (index + 1), FNV_PRIME)
    const unit = ((state >>> 8) % 1000) / 1000

    return MIN_PLAYBACK_LEVEL + unit * (1 - MIN_PLAYBACK_LEVEL)
  })
}

interface AudioPlaybackBarProps {
  readonly groupLabel: string
  readonly isDisabled?: boolean
  readonly isPlaying: boolean
  readonly levels: readonly number[]
  readonly onToggle: () => void
  readonly pauseLabel: string
  readonly playLabel: string
  readonly progress: number
  readonly timeLabel: string
}

export function AudioPlaybackBar({
  groupLabel,
  isDisabled = false,
  isPlaying,
  levels,
  onToggle,
  pauseLabel,
  playLabel,
  progress,
  timeLabel,
}: AudioPlaybackBarProps) {
  const playedSlots = Math.round(Math.min(1, Math.max(0, progress)) * levels.length)

  return (
    <div
      aria-label={groupLabel}
      className="flex w-full max-w-sm items-center gap-4 rounded-full border border-border bg-surface-raised py-1.5 pr-5 pl-1.5 shadow-sm"
      data-playback-state={isPlaying ? 'playing' : 'paused'}
      role="group"
    >
      <IconButton
        disabled={isDisabled}
        icon={isPlaying ? 'pause' : 'play'}
        label={isPlaying ? pauseLabel : playLabel}
        onClick={onToggle}
        variant="solid"
      />
      <div
        aria-hidden="true"
        className="flex h-7 min-w-0 flex-1 items-center justify-between overflow-hidden"
      >
        {levels.map((level, index) => (
          <span
            className={cn(
              'w-0.75 shrink-0 rounded-full',
              index < playedSlots ? 'bg-text' : 'bg-border',
            )}
            data-played={index < playedSlots ? 'true' : 'false'}
            data-waveform="bar"
            key={`bar-${String(index)}`}
            style={{ height: `${String(waveformBarHeight(level))}px` }}
          />
        ))}
      </div>
      <span className="shrink-0 text-sm text-text-muted tabular-nums">{timeLabel}</span>
    </div>
  )
}
