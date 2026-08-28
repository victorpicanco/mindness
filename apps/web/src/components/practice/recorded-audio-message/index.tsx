'use client'

import { useEffect, useRef } from 'react'

import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { AudioMessage } from '@/components/practice/audio-message'

interface RetainedRecording {
  readonly blob: Blob
  readonly url: string
}

interface RecordedAudioMessageProps {
  readonly label: string
}

export function RecordedAudioMessage({ label }: RecordedAudioMessageProps) {
  const session = usePracticeSessionStore((state) => state.session)
  const audioBlob = usePracticeSessionStore((state) => state.audioBlob)
  const retainedRef = useRef<RetainedRecording | null>(null)

  useEffect(
    () => () => {
      if (retainedRef.current !== null) URL.revokeObjectURL(retainedRef.current.url)
    },
    [],
  )

  function resolveSource(blob: Blob): Promise<string> {
    const retained = retainedRef.current

    if (retained !== null && retained.blob === blob) return Promise.resolve(retained.url)
    if (retained !== null) URL.revokeObjectURL(retained.url)

    const url = URL.createObjectURL(blob)
    retainedRef.current = { blob, url }

    return Promise.resolve(url)
  }

  return (
    <AudioMessage
      label={label}
      seed={session?.sessionId ?? label}
      {...(audioBlob === null ? {} : { resolveSource: () => resolveSource(audioBlob) })}
    />
  )
}
