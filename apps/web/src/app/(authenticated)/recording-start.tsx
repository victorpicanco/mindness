'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { countdownSeconds, formatCountdown, TIMER_TICK_MS } from './practice-countdown'

export class RecordingNotOpenedError extends Error {
  readonly code = 'web.RECORDING_NOT_OPENED'

  constructor(cause: unknown) {
    super('The server refused to open the recording', { cause })
    this.name = 'RecordingNotOpenedError'
  }
}

export class MicrophoneUnavailableError extends Error {
  readonly code = 'web.MICROPHONE_UNAVAILABLE'

  constructor(cause: unknown) {
    super('The microphone is not available', { cause })
    this.name = 'MicrophoneUnavailableError'
  }
}

export interface RecordingStartProps {
  readonly requestMicrophone?: () => Promise<void>
  readonly startRecording?: (sessionId: string) => Promise<void>
}

type StartFailure = 'microphone' | 'request'

async function requestBrowserMicrophone(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  for (const track of stream.getTracks()) track.stop()
}

async function requestRecordingStart(sessionId: string): Promise<void> {
  const response = await fetch(`/api/bff/sessions/${sessionId}/recording`, { method: 'POST' })

  if (!response.ok) throw new RecordingNotOpenedError(response.status)
}

export function RecordingStart({
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
  const [seconds, setSeconds] = useState(() =>
    session === null ? 0 : countdownSeconds(session.expiresAt),
  )
  const [failure, setFailure] = useState<StartFailure | null>(null)
  const expiredRef = useRef(false)

  const mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      try {
        await startRecording(sessionId)
      } catch (cause) {
        throw new RecordingNotOpenedError(cause)
      }

      try {
        await requestMicrophone()
      } catch (cause) {
        throw new MicrophoneUnavailableError(cause)
      }
    },
    onError: (error) => {
      setFailure(error instanceof MicrophoneUnavailableError ? 'microphone' : 'request')
    },
    onSuccess: () => {
      setFailure(null)
      beginRecording()
    },
  })

  useEffect(() => {
    if (session === null || status !== 'awaiting-recording') return
    const expiresAt = session.expiresAt

    function updateCountdown() {
      const nextSeconds = countdownSeconds(expiresAt)

      setSeconds(nextSeconds)

      if (nextSeconds === 0 && !expiredRef.current) {
        expiredRef.current = true
        expireSession()
        router.refresh()
      }
    }

    updateCountdown()
    const timer = window.setInterval(updateCountdown, TIMER_TICK_MS)

    return () => window.clearInterval(timer)
  }, [expireSession, router, session, status])

  if (session === null) return null

  if (status === 'expired') {
    return (
      <section className="text-center" role="alert">
        <p className="text-text-muted">{t('expired')}</p>
      </section>
    )
  }

  if (status !== 'awaiting-recording') return null

  function failureMessage(reason: StartFailure): string {
    return reason === 'microphone' ? t('microphoneError') : translate('common.errors.unknown')
  }

  return (
    <section aria-labelledby="recording-theme" className="text-center">
      <p className="text-text-muted">{t('recordingEyebrow')}</p>
      <h1
        className="font-(family-name:--font-buenard) mt-2 text-3xl leading-tight tracking-tight sm:text-4xl"
        id="recording-theme"
      >
        {session.themeTitle}
      </h1>
      <p aria-live="polite" className="mt-8 text-5xl tabular-nums" role="timer">
        {formatCountdown(seconds)}
      </p>
      <p className="mt-3 text-text-muted">{t('recordingInstruction')}</p>
      <Button
        className="mt-6"
        isLoading={mutation.isPending}
        onClick={() => {
          setFailure(null)
          mutation.mutate(session.sessionId)
        }}
        size="lg"
        type="button"
      >
        {t('startRecording')}
      </Button>
      {failure === null ? null : (
        <p className="mt-4 text-sm text-error" role="alert">
          {failureMessage(failure)}
        </p>
      )}
    </section>
  )
}
