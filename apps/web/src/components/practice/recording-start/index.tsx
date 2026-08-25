'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { bffFetch } from '@/lib/api/bff-client'
import {
  microphonePermissionDeniedSchema,
  recordingStartedSchema,
} from '@/lib/api/contracts/sessions'
import { MicrophoneUnavailableError } from '@/lib/media/microphone-unavailable-error'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { countdownSeconds, TIMER_TICK_MS } from '@/components/practice/countdown'
import { SessionRecorder } from '@/components/practice/session-recorder'
import type { AudioLevelSource } from '@/components/practice/use-audio-levels'

export interface RecordingStartProps {
  readonly audioLevelSource?: AudioLevelSource
  readonly reportMicrophonePermissionDenied?: (sessionId: string) => Promise<void>
  readonly requestMicrophone?: () => Promise<void>
  readonly startRecording?: (sessionId: string) => Promise<void>
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

function deadlineTime(expiresAt: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
  }).format(new Date(expiresAt))
}

export function RecordingStart({
  audioLevelSource,
  reportMicrophonePermissionDenied = reportDeniedMicrophonePermission,
  requestMicrophone = requestBrowserMicrophone,
  startRecording = requestRecordingStart,
}: RecordingStartProps) {
  const t = useTranslations('home.research')
  const translate = useTranslations()
  const router = useRouter()
  const session = usePracticeSessionStore((state) => state.session)
  const status = usePracticeSessionStore((state) => state.status)
  const beginRecording = usePracticeSessionStore((state) => state.beginRecording)
  const expireSession = usePracticeSessionStore((state) => state.expireSession)
  const [failure, setFailure] = useState<StartFailure | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const expiredRef = useRef(false)

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
      setIsCapturing(true)
      beginRecording()
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
            isDisabled={!isCapturing}
            isRecording={isCapturing}
            onLimitReached={() => {
              setIsCapturing(false)
            }}
            onToggleRecording={() => {
              setIsCapturing(false)
            }}
            {...(audioLevelSource === undefined ? {} : { source: audioLevelSource })}
          />
          <VisuallyHidden aria-live="polite">
            {isCapturing ? t('recordingInProgress') : ''}
          </VisuallyHidden>
        </div>
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
