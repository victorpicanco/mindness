import { Type } from 'typebox'
import { Value } from 'typebox/value'

import { TranscriptionFailedError } from '@/modules/analyses/domain/errors/transcription-failed-error/index.js'
import type { TranscriptionResult } from '@/modules/analyses/domain/ports/transcription-port/index.js'

const TranscriptionWordSchema = Type.Object({
  word: Type.String(),
  start: Type.Number(),
  end: Type.Number(),
  confidence: Type.Number(),
})

const AlternativeSchema = Type.Object({
  transcript: Type.String(),
  confidence: Type.Number(),
  words: Type.Array(TranscriptionWordSchema),
})

const TranscriptionResponseSchema = Type.Object({
  results: Type.Object({
    channels: Type.Array(
      Type.Object({
        alternatives: Type.Array(AlternativeSchema, { minItems: 1 }),
      }),
      { minItems: 1 },
    ),
  }),
  metadata: Type.Object({
    duration: Type.Number(),
  }),
})

export function parseTranscriptionResult(raw: unknown): TranscriptionResult {
  if (!Value.Check(TranscriptionResponseSchema, raw)) {
    throw new TranscriptionFailedError('malformed response')
  }

  const [channel] = raw.results.channels
  if (channel === undefined) throw new TranscriptionFailedError('malformed response')

  const [alternative] = channel.alternatives
  if (alternative === undefined) throw new TranscriptionFailedError('malformed response')

  return {
    text: alternative.transcript,
    words: alternative.words,
    averageConfidence: alternative.confidence,
    durationSeconds: raw.metadata.duration,
  }
}
