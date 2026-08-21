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

export const TranscriptionResponseSchema = Type.Object({
  results: Type.Object({
    channels: Type.Tuple([
      Type.Object({
        alternatives: Type.Tuple([AlternativeSchema]),
      }),
    ]),
  }),
  metadata: Type.Object({
    duration: Type.Number(),
  }),
})

export function parseTranscriptionResult(raw: unknown): TranscriptionResult {
  if (!Value.Check(TranscriptionResponseSchema, raw)) {
    throw new TranscriptionFailedError('malformed response')
  }

  const alternative = raw.results.channels[0].alternatives[0]

  return {
    text: alternative.transcript,
    words: alternative.words,
    averageConfidence: alternative.confidence,
    durationSeconds: raw.metadata.duration,
  }
}
