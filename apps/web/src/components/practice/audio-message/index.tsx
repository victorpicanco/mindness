'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'

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
  const [failure, setFailure] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const levels = useMemo(() => playbackLevels(seed), [seed])

  const toggle = async () => {
    const audio = audioRef.current
    if (audio === null || resolveSource === undefined || requestPendingRef.current) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }

    requestPendingRef.current = true
    setFailure(false)

    try {
      if (!audio.hasAttribute('src')) {
        setIsLoading(true)
        audio.src = await resolveSource()
      }

      await audio.play()
    } catch {
      audio.removeAttribute('src')
      setFailure(true)
    } finally {
      requestPendingRef.current = false
      setIsLoading(false)
    }
  }

  const stopPlayback = () => {
    const audio = audioRef.current
    if (audio !== null) audio.removeAttribute('src')

    setElapsedSeconds(0)
    setIsPlaying(false)
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
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
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
      {failure ? (
        <p className="text-sm text-error" role="alert">
          {t('playbackFailed')}
        </p>
      ) : null}
    </article>
  )
}
