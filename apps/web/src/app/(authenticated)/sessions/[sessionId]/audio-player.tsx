'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { z } from 'zod'

import { bffFetch } from '@/lib/api/bff-client'
import { audioPlaybackCredentialSchema } from '@/lib/api/contracts/sessions'

type PlaybackCredential = z.output<typeof audioPlaybackCredentialSchema>

export type RequestPlaybackUrl = (sessionId: string) => Promise<PlaybackCredential>

function requestPlaybackUrl(sessionId: string): Promise<PlaybackCredential> {
  return bffFetch(`/sessions/${sessionId}/audio/playback-url`, {
    cache: 'no-store',
    method: 'POST',
    schema: audioPlaybackCredentialSchema,
  })
}

interface AudioPlayerProps {
  readonly requestPlaybackUrl?: RequestPlaybackUrl
  readonly sessionId: string
}

export function AudioPlayer({
  requestPlaybackUrl: requestUrl = requestPlaybackUrl,
  sessionId,
}: AudioPlayerProps) {
  const t = useTranslations('home.analysis')
  const audioRef = useRef<HTMLAudioElement>(null)
  const requestPendingRef = useRef(false)
  const [failure, setFailure] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const play = async () => {
    const audio = audioRef.current
    if (audio === null || requestPendingRef.current || isPlaying) return

    requestPendingRef.current = true
    setFailure(false)
    setIsLoading(true)

    try {
      const credential = await requestUrl(sessionId)
      audio.src = credential.signedUrl
      await audio.play()
    } catch {
      audio.removeAttribute('src')
      setFailure(true)
    } finally {
      requestPendingRef.current = false
      setIsLoading(false)
    }
  }

  const clearPlayback = () => {
    const audio = audioRef.current
    if (audio !== null) audio.removeAttribute('src')
    setIsPlaying(false)
  }

  return (
    <div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- The complete transcript is rendered in the adjacent analysis section. */}
      <audio
        aria-label={t('recordingLabel')}
        onEnded={clearPlayback}
        onPlay={() => setIsPlaying(true)}
        preload="none"
        ref={audioRef}
      />
      <button
        className="inline-flex min-h-10 items-center justify-center rounded-full border border-border px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading || isPlaying}
        onClick={() => void play()}
        type="button"
      >
        {isLoading ? t('loadingRecording') : t('playRecording')}
      </button>
      {failure ? (
        <p className="mt-2 text-sm text-error" role="alert">
          {t('playbackFailed')}
        </p>
      ) : null}
    </div>
  )
}
