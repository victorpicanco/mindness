'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState } from 'react'

import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { countdownSeconds, formatCountdown, TIMER_TICK_MS } from '@/components/practice/countdown'

const WARNING_THRESHOLD_SECONDS = 10
const WARNING_AUDIO_SOURCE = '/countdown-warning.wav'

interface CountdownAudioFailure {
  readonly cause: unknown
  readonly event: 'countdown_audio_failed'
}

function logCountdownAudioFailure(cause: unknown) {
  const failure: CountdownAudioFailure = { cause, event: 'countdown_audio_failed' }

  console.error(failure)
}

export function ResearchTimer() {
  return <ResearchTimerView logAudioFailure={logCountdownAudioFailure} />
}

export function ResearchTimerView({
  logAudioFailure,
}: {
  readonly logAudioFailure: (cause: unknown) => void
}) {
  const t = useTranslations('home.research')
  const themeId = useId()
  const session = usePracticeSessionStore((state) => state.session)
  const status = usePracticeSessionStore((state) => state.status)
  const openRecordingWindow = usePracticeSessionStore((state) => state.openRecordingWindow)
  const serverTimeOffsetMs = usePracticeSessionStore((state) => state.serverTimeOffsetMs)
  const [seconds, setSeconds] = useState(() =>
    session === null ? 0 : countdownSeconds(session.researchEndsAt, serverTimeOffsetMs),
  )
  const audioRef = useRef<HTMLAudioElement>(null)
  const warningPlayedRef = useRef(false)
  const windowOpenedRef = useRef(false)

  useEffect(() => {
    if (session === null || status !== 'researching') return
    const researchEndsAt = session.researchEndsAt

    function updateCountdown() {
      const nextSeconds = countdownSeconds(researchEndsAt, serverTimeOffsetMs)

      setSeconds(nextSeconds)

      if (
        nextSeconds > 0 &&
        nextSeconds <= WARNING_THRESHOLD_SECONDS &&
        !warningPlayedRef.current
      ) {
        warningPlayedRef.current = true
        const playback = audioRef.current?.play()

        if (playback !== undefined) void playback.catch(logAudioFailure)
      }

      if (nextSeconds === 0 && !windowOpenedRef.current) {
        windowOpenedRef.current = true
        openRecordingWindow()
      }
    }

    updateCountdown()
    const timer = window.setInterval(updateCountdown, TIMER_TICK_MS)

    return () => window.clearInterval(timer)
  }, [logAudioFailure, openRecordingWindow, serverTimeOffsetMs, session, status])

  if (session === null) return null

  return (
    <section aria-labelledby={themeId} className="mt-2">
      <h1
        className="font-(family-name:--font-buenard) text-2xl leading-tight tracking-tight sm:text-3xl"
        id={themeId}
      >
        {session.themeTitle}
      </h1>
      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="text-sm text-text-muted">{t('eyebrow')}</span>
        <p aria-live="polite" className="text-2xl font-medium tabular-nums" role="timer">
          {formatCountdown(seconds)}
        </p>
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- The warning is a non-speech tone with no content to caption. */}
      <audio aria-hidden="true" preload="auto" ref={audioRef} src={WARNING_AUDIO_SOURCE} />
    </section>
  )
}
