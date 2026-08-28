'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { ShinyText } from '@/components/ui/shiny-text'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { SessionRecorder } from '@/components/practice/session-recorder'
import type { AudioLevelSource } from '@/components/practice/use-audio-levels'
import {
  useRecordingCapture,
  type StartFailure,
  type UploadFailure,
} from '@/components/practice/use-recording-capture'

type RecordingStartViewProps = {
  readonly audioLevelSource?: AudioLevelSource
  readonly capture: ReturnType<typeof useRecordingCapture>
}

export function RecordingStart() {
  const capture = useRecordingCapture({})

  return <RecordingStartView capture={capture} />
}

export function RecordingStartView({ audioLevelSource, capture }: RecordingStartViewProps) {
  const t = useTranslations('home.research')
  const translate = useTranslations()
  const session = usePracticeSessionStore((state) => state.session)
  const status = usePracticeSessionStore((state) => state.status)
  const serverTimeOffsetMs = usePracticeSessionStore((state) => state.serverTimeOffsetMs)

  function startFailureMessage(reason: StartFailure): string {
    if (reason === 'permission-denied') return t('microphonePermissionDenied')

    return reason === 'microphone' ? t('microphoneError') : translate('common.errors.unknown')
  }

  function uploadFailureMessage(reason: UploadFailure): string {
    if (reason === 'audio-size') return t('audioSizeRejected')
    if (reason === 'audio-validation') return t('audioValidationRejected')
    if (reason === 'session-closed') return t('sessionNotInProgress')

    return t('audioUploadFailed')
  }

  if (session === null) return null

  if (status === 'recording') {
    return (
      <div aria-label={t('recordingActiveLabel')}>
        <SessionRecorder
          isDisabled={false}
          isRecording
          onLimitReached={capture.finish}
          onToggleRecording={capture.finish}
          serverTimeOffsetMs={serverTimeOffsetMs}
          source={audioLevelSource}
          startedAt={session.recordingStartedAt ?? undefined}
        />
        <VisuallyHidden aria-live="polite">{t('recordingInProgress')}</VisuallyHidden>
      </div>
    )
  }

  if (status === 'awaiting-recording') {
    return (
      <section>
        {capture.startFailure === null ? null : (
          <p className="mb-3 text-center text-sm text-error" role="alert">
            {startFailureMessage(capture.startFailure)}
          </p>
        )}
        {capture.isStarting ? (
          <p className="mb-1.5 text-xs" role="status">
            <ShinyText text={t('preparingMicrophone')} />
          </p>
        ) : null}
        <IdleRecorder isDisabled={capture.isStarting} onStart={capture.start} />
      </section>
    )
  }

  if (status === 'uploading') {
    return (
      <section aria-label={t('uploadingLabel')} className="text-center">
        {capture.hasUploadFailed && capture.uploadFailure !== null ? (
          <div className="mb-3 flex flex-col items-center gap-3">
            <p className="text-sm text-error" role="alert">
              {uploadFailureMessage(capture.uploadFailure)}
            </p>
            <div className="flex gap-3">
              {capture.uploadFailure === 'audio-upload' ? (
                <Button onClick={capture.retry} type="button">
                  {t('retryUpload')}
                </Button>
              ) : null}
              <Button onClick={capture.discard} type="button" variant="secondary">
                {t('discardRecording')}
              </Button>
            </div>
          </div>
        ) : null}
        <IdleRecorder />
      </section>
    )
  }

  if (status === 'expired') {
    return (
      <div>
        {capture.startFailure === null ? null : (
          <p className="mb-3 text-center text-sm text-error" role="alert">
            {startFailureMessage(capture.startFailure)}
          </p>
        )}
        <IdleRecorder />
      </div>
    )
  }

  return <IdleRecorder />
}

interface IdleRecorderProps {
  readonly isDisabled?: boolean
  readonly onStart?: () => void
}

function IdleRecorder({ isDisabled = true, onStart }: IdleRecorderProps) {
  return (
    <SessionRecorder
      isDisabled={isDisabled}
      isRecording={false}
      onLimitReached={() => undefined}
      onToggleRecording={onStart ?? (() => undefined)}
    />
  )
}
