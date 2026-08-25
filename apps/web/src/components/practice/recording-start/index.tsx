'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { bffFetch } from '@/lib/api/bff-client'
import {
  microphonePermissionDeniedSchema,
  recordingStartedSchema,
} from '@/lib/api/contracts/sessions'
import { submitRecording as requestRecordingSubmission } from '@/lib/api/submit-recording'
import { MicrophoneUnavailableError } from '@/lib/media/microphone-unavailable-error'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { countdownSeconds, TIMER_TICK_MS } from '@/components/practice/countdown'
import { SessionRecorder } from '@/components/practice/session-recorder'
import type { AudioLevelSource } from '@/components/practice/use-audio-levels'

export interface AudioRecordingSession {
  readonly stop: () => Promise<Blob>
}

export type AudioRecordingSource = () => Promise<AudioRecordingSession>

export type SubmitRecordingRequest = (input: {
  readonly audioBlob: Blob
  readonly sessionId: string
}) => Promise<void>

export interface RecordingStartProps {
  readonly audioLevelSource?: AudioLevelSource
  readonly captureRecording?: AudioRecordingSource
  readonly reportMicrophonePermissionDenied?: (sessionId: string) => Promise<void>
  readonly requestMicrophone?: () => Promise<void>
  readonly startRecording?: (sessionId: string) => Promise<void>
  readonly submitRecording?: SubmitRecordingRequest
}

type StartFailure = 'microphone' | 'permission-denied' | 'request'

const THEME_CLASSES =
  'font-(family-name:--font-buenard) text-4xl leading-tight tracking-tight text-balance sm:text-5xl'

async function requestBrowserMicrophone(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  for (const track of stream.getTracks()) track.stop()
}

async function requestRecordingStart(sessionId: string): Promise<void> {
  await bffFetch(`/sessions/${sessionId}/recording`, {
    method: 'POST',
    schema: recordingStartedSchema,
  })
}

async function reportDeniedMicrophonePermission(sessionId: string): Promise<void> {
  await bffFetch(`/sessions/${sessionId}/microphone-permission-denied`, {
    method: 'POST',
    schema: microphonePermissionDeniedSchema,
  })
}

async function browserAudioRecordingSource(): Promise<AudioRecordingSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream)

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  recorder.start()

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.addEventListener(
          'stop',
          () => {
            for (const track of stream.getTracks()) track.stop()
            resolve(new Blob(chunks, { type: recorder.mimeType }))
          },
          { once: true },
        )
        recorder.stop()
      }),
  }
}

function deadlineTime(expiresAt: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
  }).format(new Date(expiresAt))
}

export function RecordingStart({
  audioLevelSource,
  captureRecording = browserAudioRecordingSource,
  reportMicrophonePermissionDenied = reportDeniedMicrophonePermission,
  requestMicrophone = requestBrowserMicrophone,
  startRecording = requestRecordingStart,
  submitRecording = requestRecordingSubmission,
}: RecordingStartProps) {
  const t = useTranslations('home.research')
  const translate = useTranslations()
  const router = useRouter()
  const session = usePracticeSessionStore((state) => state.session)
  const status = usePracticeSessionStore((state) => state.status)
  const storedAudioBlob = usePracticeSessionStore((state) => state.audioBlob)
  const beginRecording = usePracticeSessionStore((state) => state.beginRecording)
  const expireSession = usePracticeSessionStore((state) => state.expireSession)
  const captureAudio = usePracticeSessionStore((state) => state.captureAudio)
  const discardAudio = usePracticeSessionStore((state) => state.discardAudio)
  const beginProcessing = usePracticeSessionStore((state) => state.beginProcessing)
  const [failure, setFailure] = useState<StartFailure | null>(null)
  const expiredRef = useRef(false)
  const captureRef = useRef<AudioRecordingSession | null>(null)

  const mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await startRecording(sessionId)

      try {
        await requestMicrophone()
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
          await reportMicrophonePermissionDenied(sessionId)
        }

        throw new MicrophoneUnavailableError(cause)
      }
    },
    onError: (error) => {
      const permissionDenied =
        error instanceof MicrophoneUnavailableError &&
        error.cause instanceof DOMException &&
        error.cause.name === 'NotAllowedError'

      if (permissionDenied) {
        setFailure('permission-denied')
        expireSession()
        return
      }

      setFailure(error instanceof MicrophoneUnavailableError ? 'microphone' : 'request')
    },
    onSuccess: () => {
      setFailure(null)
      beginRecording()
    },
  })

  const submitMutation = useMutation({
    mutationFn: submitRecording,
    onSuccess: () => {
      beginProcessing()
    },
  })

  useEffect(() => {
    if (session === null || status !== 'awaiting-recording') return
    const expiresAt = session.expiresAt

    function checkExpiration() {
      if (countdownSeconds(expiresAt) === 0 && !expiredRef.current) {
        expiredRef.current = true
        expireSession()
        router.refresh()
      }
    }

    checkExpiration()
    const timer = window.setInterval(checkExpiration, TIMER_TICK_MS)

    return () => window.clearInterval(timer)
  }, [expireSession, router, session, status])

  useEffect(() => {
    if (status !== 'recording') return

    let isCancelled = false

    captureRecording()
      .then((recordingSession) => {
        if (isCancelled) {
          void recordingSession.stop()
          return
        }

        captureRef.current = recordingSession
      })
      .catch(() => undefined)

    return () => {
      isCancelled = true
      captureRef.current = null
    }
  }, [captureRecording, status])

  async function finishRecording() {
    const recordingSession = captureRef.current
    if (recordingSession === null || session === null) return

    captureRef.current = null
    const audioBlob = await recordingSession.stop()

    captureAudio(audioBlob)
    submitMutation.mutate({ audioBlob, sessionId: session.sessionId })
  }

  function retryUpload() {
    if (session === null || storedAudioBlob === null) return
    submitMutation.mutate({ audioBlob: storedAudioBlob, sessionId: session.sessionId })
  }

  function discardRecording() {
    discardAudio()
    submitMutation.reset()
  }

  if (session === null) return null

  if (status === 'expired') {
    return (
      <section className="m-auto text-center" role="alert">
        <p className="text-text-muted">
          {failure === 'permission-denied' ? t('microphonePermissionDenied') : t('expired')}
        </p>
      </section>
    )
  }

  if (status === 'recording') {
    return (
      <section aria-label={t('recordingActiveLabel')} className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto flex min-h-0 max-w-2xl flex-1 items-center justify-center">
          <h1 className={`${THEME_CLASSES} text-center`}>{session.themeTitle}</h1>
        </div>
        <div className="mx-auto w-full max-w-3xl">
          <SessionRecorder
            isDisabled={false}
            isRecording
            onLimitReached={() => {
              void finishRecording()
            }}
            onToggleRecording={() => {
              void finishRecording()
            }}
            {...(audioLevelSource === undefined ? {} : { source: audioLevelSource })}
          />
          <VisuallyHidden aria-live="polite">{t('recordingInProgress')}</VisuallyHidden>
        </div>
      </section>
    )
  }

  if (status === 'uploading') {
    return (
      <section
        aria-label={t('uploadingLabel')}
        className="m-auto flex flex-col items-center gap-4 text-center"
      >
        <h1 className={THEME_CLASSES}>{session.themeTitle}</h1>
        {submitMutation.isError ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-error" role="alert">
              {t('audioUploadFailed')}
            </p>
            <div className="flex gap-3">
              <Button onClick={retryUpload} type="button">
                {t('retryUpload')}
              </Button>
              <Button onClick={discardRecording} type="button" variant="secondary">
                {t('discardRecording')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-text-muted" role="status">
            {t('uploading')}
          </p>
        )}
      </section>
    )
  }

  if (status !== 'awaiting-recording') return null

  function failureMessage(reason: StartFailure): string {
    if (reason === 'permission-denied') return t('microphonePermissionDenied')
    return reason === 'microphone' ? t('microphoneError') : translate('common.errors.unknown')
  }

  return (
    <section aria-labelledby="recording-theme" className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex min-h-0 max-w-2xl flex-1 flex-col items-center justify-center gap-8 text-center">
        <div>
          <p className="text-text-muted">{t('recordingEyebrow')}</p>
          <h1 className={`${THEME_CLASSES} mt-2`} id="recording-theme">
            {session.themeTitle}
          </h1>
        </div>
        {failure === null ? null : (
          <p className="text-sm text-error" role="alert">
            {failureMessage(failure)}
          </p>
        )}
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <p className="mb-2 text-center text-xs text-text-muted">
          {t('recordUntil', { time: deadlineTime(session.expiresAt) })}
        </p>
        <SessionRecorder
          isDisabled={mutation.isPending}
          isRecording={false}
          onLimitReached={() => undefined}
          onToggleRecording={() => {
            setFailure(null)
            mutation.mutate(session.sessionId)
          }}
        />
      </div>
    </section>
  )
}
