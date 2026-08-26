'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { countdownSeconds, formatCountdown, TIMER_TICK_MS } from '@/components/practice/countdown'

const WARNING_THRESHOLD_SECONDS = 10
const WARNING_AUDIO_SOURCE =
  'data:audio/wav;base64,UklGRqQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YYACAAAAAEsA5wA2Aa0ASv+s/c78e/2+/7MC5QT8BIoCZ/5w+q74U/r4/qgEswjsCNcECf6S95z04faz/SEGPgzxDIcHL/4f9azwOfP3+xcHdQ/2EIsK2f4k8/Lsbu/P+YgHShLnFNMNAACo8YDplOtG93IHrhSwGE0RnAGx8GjmwOdu9NoGlxY8HOQUowNC8LjjBuRW8cUF/hd7H4QYBgZZ8HzheuAR7jwE3RhaIhkctwj08MDfMN206ksCMxnNJI4fogsK8ojeOtpS5wAAARnIJtAitw6T89vdptcB5Gv9TRhAKMol3xGD9bjdhNXU4J76HBcwKW0oBxXK9x3e3dPg3az3ehWVKakqGxhY+gbfvNI236r0dBNuKXEsBhsc/WngJNLp2KzxGBG+KLottR0AAD3iGdIF18bueA6MJ3wuFSDxAnPkmtKY1Q3spgvhJbQuFyLbBfvmotOs1JPptgjHI14urCOpCMXpLNVH1GrnvQVOIX0tySRIC73sLtdt1KLlzwKFHhYsZSWjDdDvmtkf1UnkAAB+GzAqeSWsD+jyZNxc1mnjZP1NGNQnASVREfH1ed8d2AvjDfsFFRElACSHEtj4yOJa2jTjDfm8EfYhdiJCE4j7POYI3efjcfeGDpMeayB8E/D9w+kZ4CLlRvZ2C/wa5x0uEwAARu1+4+PmlvWhCEMX9xpZEqkBsfAm5yLpaPUXBn8TqBf9EN8C8fP86tXrv/XpA8MPCxQfD5kD8/bt7vHunvYkAiQMMRDHDNIDpfnl8mXyAPjUALYILwz+CYUD+fvO9iL24vkAAIsFGAjTBrMC4P2U+hX6Ovyv/7MCAgRUA18BUP8k/ir+/v7i/z8A'

interface CountdownAudioFailure {
  readonly cause: unknown
  readonly event: 'countdown_audio_failed'
}

export interface ResearchTimerProps {
  readonly logAudioFailure?: (cause: unknown) => void
}

function logCountdownAudioFailure(cause: unknown) {
  const failure: CountdownAudioFailure = { cause, event: 'countdown_audio_failed' }

  console.error(failure)
}

export function ResearchTimer({ logAudioFailure = logCountdownAudioFailure }: ResearchTimerProps) {
  const t = useTranslations('home.research')
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

  if (session === null || status !== 'researching') return null

  return (
    <section aria-labelledby="research-theme" className="m-auto text-center">
      <p className="text-text-muted">{t('eyebrow')}</p>
      <h1
        className="font-(family-name:--font-buenard) mt-2 text-3xl leading-tight tracking-tight sm:text-4xl"
        id="research-theme"
      >
        {session.themeTitle}
      </h1>
      <p aria-live="polite" className="mt-8 text-5xl tabular-nums" role="timer">
        {formatCountdown(seconds)}
      </p>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- The warning is a non-speech tone with no content to caption. */}
      <audio aria-hidden="true" preload="auto" ref={audioRef} src={WARNING_AUDIO_SOURCE} />
    </section>
  )
}
