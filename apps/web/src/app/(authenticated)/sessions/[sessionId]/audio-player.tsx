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

interface AudioPlayerProps {
  readonly label: string
  readonly requestPlaybackUrl?: RequestPlaybackUrl
  readonly sessionId: string
}

export function AudioPlayer({
  label,
  requestPlaybackUrl: requestUrl = requestPlaybackUrl,
  sessionId,
}: AudioPlayerProps) {
  return (
    <AudioMessage
      label={label}
      resolveSource={async () => (await requestUrl(sessionId)).signedUrl}
      seed={sessionId}
    />
  )
}
