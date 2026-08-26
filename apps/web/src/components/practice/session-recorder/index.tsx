'use client'

import { useTranslations } from 'next-intl'

import { AudioRecorderBar } from '@/components/practice/audio-recorder-bar'
import { formatCountdown } from '@/components/practice/countdown'
import { type AudioLevelSource, useAudioLevels } from '@/components/practice/use-audio-levels'
import { useRecordingClock } from '@/components/practice/use-recording-clock'
import { WAVEFORM_SLOT_COUNT } from '@/components/practice/waveform-track'

export interface SessionRecorderProps {
  readonly isDisabled?: boolean
  readonly isRecording: boolean
  readonly onLimitReached: () => void
  readonly onToggleRecording: () => void
  readonly source?: AudioLevelSource
  readonly startedAt?: string
}

// The captured levels stay in this leaf so the fifteen updates per second of the waveform never
// re-render the countdown and the mutation that live in the screen above it.
export function SessionRecorder({
  isDisabled = false,
  isRecording,
  onLimitReached,
  onToggleRecording,
  source,
  startedAt,
}: SessionRecorderProps) {
  const t = useTranslations('home.research')
  const { hasFailed, levels } = useAudioLevels({
    historySize: WAVEFORM_SLOT_COUNT,
    isActive: isRecording,
    ...(source === undefined ? {} : { source }),
  })
  const elapsedSeconds = useRecordingClock({
    isActive: isRecording,
    onLimitReached,
    ...(startedAt === undefined ? {} : { startedAt }),
  })

  return (
    <div>
      <AudioRecorderBar
        elapsedLabel={formatCountdown(elapsedSeconds)}
        groupLabel={t('recordingInputLabel')}
        isDisabled={isDisabled}
        isRecording={isRecording}
        levels={levels}
        onToggleRecording={onToggleRecording}
        recordLabel={t('startRecording')}
        stopLabel={t('stopRecording')}
      />
      {hasFailed ? (
        <p className="mt-4 text-center text-sm text-error" role="alert">
          {t('microphoneError')}
        </p>
      ) : null}
    </div>
  )
}
