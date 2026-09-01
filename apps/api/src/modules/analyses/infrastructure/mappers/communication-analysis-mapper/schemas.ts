import { Type } from 'typebox'
import { Value } from 'typebox/value'

import {
  ALIGNMENT_QUALITIES,
  AUDIO_USABILITIES,
  FEEDBACK_CONFIDENCES,
  MOMENT_CATEGORIES,
  MOMENT_VALENCES,
  TIMING_BASES,
} from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'
import type { CreateCommunicationFeedbackParams } from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

const Text = Type.String({ minLength: 1 })
const Seconds = Type.Number({ minimum: 0 })
const MomentId = Type.String({ pattern: '^M[1-9][0-9]*$' })

const PersistedFeedbackSchema = Type.Object(
  {
    durationSeconds: Type.Number({ exclusiveMinimum: 0 }),
    audioUsability: Type.Union(AUDIO_USABILITIES.map((value) => Type.Literal(value))),
    alignmentQuality: Type.Union(ALIGNMENT_QUALITIES.map((value) => Type.Literal(value))),
    limitations: Type.Array(Text),
    literalTranscript: Text,
    mainMessage: Text,
    attemptedStructure: Text,
    summary: Text,
    strengths: Type.Array(
      Type.Object(
        { title: Text, evidence: Text, whyItHelped: Text },
        { additionalProperties: false },
      ),
    ),
    moments: Type.Array(
      Type.Object(
        {
          id: MomentId,
          startSeconds: Seconds,
          endSeconds: Seconds,
          timingBasis: Type.Union(TIMING_BASES.map((value) => Type.Literal(value))),
          excerpt: Text,
          observation: Text,
          impact: Text,
          nextAttempt: Text,
          clearerAlternative: Type.Union([Text, Type.Null()]),
          categories: Type.Array(Type.Union(MOMENT_CATEGORIES.map((value) => Type.Literal(value)))),
          valence: Type.Union(MOMENT_VALENCES.map((value) => Type.Literal(value))),
          confidence: Type.Union(FEEDBACK_CONFIDENCES.map((value) => Type.Literal(value))),
        },
        { additionalProperties: false },
      ),
    ),
    patterns: Type.Array(
      Type.Object(
        {
          title: Text,
          description: Text,
          evidenceMomentIds: Type.Array(MomentId),
          impact: Text,
          exercise: Text,
        },
        { additionalProperties: false },
      ),
    ),
    asrDivergences: Type.Array(
      Type.Object(
        {
          startSeconds: Seconds,
          endSeconds: Seconds,
          asrVersion: Text,
          heardVersion: Text,
          relevance: Text,
        },
        { additionalProperties: false },
      ),
    ),
    priorities: Type.Array(
      Type.Object(
        {
          title: Text,
          behavior: Text,
          evidenceMomentIds: Type.Array(MomentId),
          importance: Text,
          action: Text,
          exercise: Text,
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
)

export function parsePersistedFeedback(raw: unknown): CreateCommunicationFeedbackParams {
  if (!Value.Check(PersistedFeedbackSchema, raw)) {
    throw new DatabaseError('Invalid persisted communication feedback')
  }

  return raw
}
