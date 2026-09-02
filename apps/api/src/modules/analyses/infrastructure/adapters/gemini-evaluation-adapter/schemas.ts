import { Type } from 'typebox'
import { Value } from 'typebox/value'

import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import type { SpeechFeedback } from '@/modules/analyses/domain/ports/evaluation-port/index.js'

const MAX_TEXT_LENGTH = 1_200
const MARKUP_PATTERN = /<[A-Za-z/]|```|\[[^\]]+\]\([^)]*\)/

const FeedbackPointSchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 120 }),
    evidence: Type.String({ minLength: 1, maxLength: MAX_TEXT_LENGTH }),
  },
  { additionalProperties: false },
)

const ImprovementPointSchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 120 }),
    evidence: Type.String({ minLength: 1, maxLength: MAX_TEXT_LENGTH }),
    action: Type.String({ minLength: 1, maxLength: MAX_TEXT_LENGTH }),
  },
  { additionalProperties: false },
)

const SpeechFeedbackSchema = Type.Object(
  {
    summary: Type.String({ minLength: 1, maxLength: MAX_TEXT_LENGTH }),
    strengths: Type.Array(FeedbackPointSchema, { maxItems: 3 }),
    improvements: Type.Array(ImprovementPointSchema, { maxItems: 3 }),
  },
  { additionalProperties: false },
)

export function parseSpeechFeedback(raw: unknown): SpeechFeedback {
  if (!Value.Check(SpeechFeedbackSchema, raw)) {
    throw new MalformedEvaluationError('schema')
  }

  for (const text of collectText(raw)) {
    if (MARKUP_PATTERN.test(text)) throw new MalformedEvaluationError('markup')
  }

  return raw
}

function collectText(feedback: SpeechFeedback): readonly string[] {
  return [
    feedback.summary,
    ...feedback.strengths.flatMap((item) => [item.title, item.evidence]),
    ...feedback.improvements.flatMap((item) => [item.title, item.evidence, item.action]),
  ]
}
