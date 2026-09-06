'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAnalysisPlayback } from '@/components/practice/analysis-playback'
import { toast } from 'sonner'

import { AudioPlaybackBar, playbackLevels } from '@/components/practice/audio-playback-bar'
import { formatCountdown } from '@/components/practice/countdown'
import { ShinyText } from '@/components/ui/shiny-text'

export type ResolveAudioSource = () => Promise<string>

interface AudioMessageProps {
  readonly label: string
  readonly resolveSource?: ResolveAudioSource
  readonly seed: string
}

function playedSeconds(audio: HTMLAudioElement): number {
  return Number.isFinite(audio.currentTime) ? Math.floor(audio.currentTime) : 0
}

export function AudioMessage({ label, resolveSource, seed }: AudioMessageProps) {
  const t = useTranslations('home.audio')
  const audioRef = useRef<HTMLAudioElement>(null)
  const requestPendingRef = useRef(false)
  const pendingSeekRef = useRef<number | null>(null)
  const excerptRef = useRef<number | null>(null)
  const playback = useAnalysisPlayback()
  const register = playback?.register
  const reportPlaying = playback?.reportPlaying
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const levels = useMemo(() => playbackLevels(seed), [seed])

  const applyPendingSeek = useCallback((audio: HTMLAudioElement) => {
    const target = pendingSeekRef.current
    if (target === null || !Number.isFinite(audio.duration)) return
    audio.currentTime = Math.min(target, Math.max(0, audio.duration - 0.01))
    pendingSeekRef.current = null
    setElapsedSeconds(playedSeconds(audio))
  }, [])

  const startPlayback = useCallback(
    async (startSeconds?: number) => {
      const audio = audioRef.current
      if (audio === null || resolveSource === undefined) return
      excerptRef.current = startSeconds ?? null
      if (startSeconds !== undefined) pendingSeekRef.current = startSeconds
      if (requestPendingRef.current) return
      requestPendingRef.current = true

      try {
        if (!audio.hasAttribute('src')) {
          setIsLoading(true)
          const source = await resolveSource()
          if (audioRef.current !== audio) return
          audio.src = source
        }
        if (audio.readyState >= 1) applyPendingSeek(audio)
        await audio.play()
      } catch (cause: unknown) {
        if (audioRef.current !== audio) return
        if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
          setIsPlaying(false)
          toast.error(t('pressPlay'))
        } else {
          audio.removeAttribute('src')
          pendingSeekRef.current = null
          toast.error(t('playbackFailed'))
        }
      } finally {
        requestPendingRef.current = false
        if (audioRef.current === audio) setIsLoading(false)
      }
    },
    [resolveSource, applyPendingSeek, t],
  )

  const pausePlayback = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  useEffect(() => {
    if (register === undefined || resolveSource === undefined) return
    return register({
      pause: pausePlayback,
      playFrom: (seconds) => {
        void startPlayback(seconds)
      },
    })
  }, [register, resolveSource, startPlayback, pausePlayback])

  const toggle = () => {
    const audio = audioRef.current
    if (audio !== null && isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      void startPlayback()
    }
  }

  const stopPlayback = () => {
    const audio = audioRef.current
    if (audio !== null) audio.removeAttribute('src')

    excerptRef.current = null
    pendingSeekRef.current = null
    setElapsedSeconds(0)
    setIsPlaying(false)
    reportPlaying?.(null)
  }

  const progress = durationSeconds === 0 ? 0 : elapsedSeconds / durationSeconds

  return (
    <article aria-label={label} className="flex flex-col items-end gap-2">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- The complete transcript is rendered in the adjacent analysis section. */}
      <audio
        aria-label={t('recordingLabel')}
        onEnded={stopPlayback}
        onLoadedMetadata={(event) => {
          const { duration } = event.currentTarget

          setDurationSeconds(Number.isFinite(duration) ? Math.floor(duration) : 0)
          applyPendingSeek(event.currentTarget)
        }}
        onPause={() => {
          setIsPlaying(false)
          reportPlaying?.(null)
        }}
        onPlay={() => {
          setIsPlaying(true)
          reportPlaying?.(excerptRef.current)
        }}
        onTimeUpdate={(event) => setElapsedSeconds(playedSeconds(event.currentTarget))}
        preload="none"
        ref={audioRef}
      />
      <AudioPlaybackBar
        groupLabel={t('groupLabel')}
        isDisabled={resolveSource === undefined || isLoading}
        isPlaying={isPlaying}
        levels={levels}
        onToggle={() => void toggle()}
        pauseLabel={t('pause')}
        playLabel={t('play')}
        progress={progress}
        timeLabel={formatCountdown(elapsedSeconds > 0 ? elapsedSeconds : durationSeconds)}
      />
      {isLoading ? (
        <p className="text-sm" role="status">
          <ShinyText text={t('loading')} />
        </p>
      ) : null}
    </article>
  )
}
