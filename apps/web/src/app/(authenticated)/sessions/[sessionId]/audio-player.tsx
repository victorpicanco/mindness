'use client'

import type { z } from 'zod'

import { bffFetch } from '@/lib/api/bff-client'
import { audioPlaybackCredentialSchema } from '@/lib/api/contracts/sessions'

import { AudioMessage } from '@/components/practice/audio-message'

type PlaybackCredential = z.output<typeof audioPlaybackCredentialSchema>

export type RequestPlaybackUrl = (sessionId: string) => Promise<PlaybackCredential>

function requestPlaybackUrl(sessionId: string): Promise<PlaybackCredential> {
  return bffFetch(`/sessions/${sessionId}/audio/playback-url`, {
    cache: 'no-store',
    method: 'POST',
    schema: audioPlaybackCredentialSchema,
  })
}

type AudioPlayerProps = {
  readonly label: string
  readonly sessionId: string
}

export function AudioPlayer(props: AudioPlayerProps) {
  return <AudioPlayerView {...props} requestPlaybackUrl={requestPlaybackUrl} />
}

type AudioPlayerViewProps = AudioPlayerProps & {
  readonly requestPlaybackUrl: RequestPlaybackUrl
}

export function AudioPlayerView({
  label,
  requestPlaybackUrl: requestUrl,
  sessionId,
}: AudioPlayerViewProps) {
  return (
    <AudioMessage
      label={label}
      resolveSource={async () => (await requestUrl(sessionId)).signedUrl}
      seed={sessionId}
    />
  )
}
