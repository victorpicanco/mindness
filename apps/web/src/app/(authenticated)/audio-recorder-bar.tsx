import { IconButton } from '@/components/ui/icon-button'

import { WaveformTrack } from './waveform-track'

export interface AudioRecorderBarProps {
  readonly elapsedLabel: string
  readonly groupLabel: string
  readonly isDisabled?: boolean
  readonly isRecording: boolean
  readonly levels: readonly number[]
  readonly onToggleRecording: () => void
  readonly recordLabel: string
  readonly stopLabel: string
}

export function AudioRecorderBar({
  elapsedLabel,
  groupLabel,
  isDisabled = false,
  isRecording,
  levels,
  onToggleRecording,
  recordLabel,
  stopLabel,
}: AudioRecorderBarProps) {
  return (
    <div
      aria-label={groupLabel}
      className="flex w-full items-center gap-4 rounded-full border border-border bg-surface-raised py-1.5 pr-1.5 pl-6 shadow-sm"
      data-recording-state={isRecording ? 'recording' : 'idle'}
      role="group"
    >
      <WaveformTrack levels={levels} />
      <span
        className={`shrink-0 text-sm tabular-nums transition-colors ${isRecording ? 'text-text' : 'text-text-muted'}`}
        {...(isRecording ? { role: 'timer' } : {})}
      >
        {elapsedLabel}
      </span>
      <IconButton
        disabled={isDisabled}
        icon={isRecording ? 'stop' : 'audio-wave-01'}
        label={isRecording ? stopLabel : recordLabel}
        onClick={onToggleRecording}
        variant="solid"
      />
    </div>
  )
}
