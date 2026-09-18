'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

import { ShinyText } from '@/components/ui/shiny-text'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { showAlertDialog, type AlertDialogAction } from '@/lib/feedback/alert-dialog'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { SessionRecorder } from '@/components/practice/session-recorder'
import type { AudioLevelSource } from '@/components/practice/use-audio-levels'
import {
  useRecordingCapture,
  type UploadFailure,
} from '@/components/practice/use-recording-capture'

type UploadFailureTranslator = (
  key:
    'audioSizeRejected' | 'audioUploadFailed' | 'audioValidationRejected' | 'sessionNotInProgress',
) => string

function uploadFailureMessage(reason: UploadFailure, t: UploadFailureTranslator): string {
  if (reason === 'audio-size') return t('audioSizeRejected')
  if (reason === 'audio-validation') return t('audioValidationRejected')
  if (reason === 'session-closed') return t('sessionNotInProgress')

  return t('audioUploadFailed')
}

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
  const alerts = useTranslations('common.alerts')
  const session = usePracticeSessionStore((state) => state.session)
  const status = usePracticeSessionStore((state) => state.status)
  const serverTimeOffsetMs = usePracticeSessionStore((state) => state.serverTimeOffsetMs)
  const { discard, hasUploadFailed, retry, startFailure, uploadFailure } = capture

  useEffect(() => {
    if (startFailure === null) return

    showAlertDialog({
      description:
        startFailure === 'permission-denied'
          ? t('microphonePermissionDenied')
          : t('microphoneError'),
      title: alerts('failureTitle'),
    })
  }, [alerts, startFailure, t])

  useEffect(() => {
    if (!hasUploadFailed || uploadFailure === null) return

    const actions: readonly AlertDialogAction[] =
      uploadFailure === 'audio-upload'
        ? [
            { label: t('discardRecording'), onSelect: discard },
            { label: t('retryUpload'), onSelect: retry },
          ]
        : [{ label: t('discardRecording'), onSelect: discard }]

    showAlertDialog({
      actions,
      description: uploadFailureMessage(uploadFailure, t),
      title: alerts('failureTitle'),
    })
  }, [alerts, discard, hasUploadFailed, retry, t, uploadFailure])

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
        <IdleRecorder />
      </section>
    )
  }

  if (status === 'expired') {
    return (
      <div>
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
