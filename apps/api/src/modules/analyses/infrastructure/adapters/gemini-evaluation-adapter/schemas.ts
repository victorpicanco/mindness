import { Type } from 'typebox'
import { Value } from 'typebox/value'

import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import type { EvaluationResult } from '@/modules/analyses/domain/ports/evaluation-port/index.js'

const MAX_GUIDANCE_LENGTH = 600
const MARKUP_PATTERN = /<[A-Za-z/]|```|\[[^\]]+\]\([^)]*\)/

export const EvaluationResultSchema = Type.Object(
  {
    clarityScore: Type.Integer({ minimum: 0, maximum: 100 }),
    clarityGuidance: Type.String({ minLength: 1, maxLength: MAX_GUIDANCE_LENGTH }),
    fluencyScore: Type.Integer({ minimum: 0, maximum: 100 }),
    fluencyGuidance: Type.String({ minLength: 1, maxLength: MAX_GUIDANCE_LENGTH }),
    masteryScore: Type.Integer({ minimum: 0, maximum: 100 }),
    masteryGuidance: Type.String({ minLength: 1, maxLength: MAX_GUIDANCE_LENGTH }),
  },
  { additionalProperties: false },
)

export function parseEvaluationResult(
  raw: unknown,
): Omit<EvaluationResult, 'inputTokens' | 'outputTokens'> {
  if (!Value.Check(EvaluationResultSchema, raw)) {
    throw new MalformedEvaluationError('schema')
  }

  for (const [field, guidance] of Object.entries({
    clarityGuidance: raw.clarityGuidance,
    fluencyGuidance: raw.fluencyGuidance,
    masteryGuidance: raw.masteryGuidance,
  })) {
    if (MARKUP_PATTERN.test(guidance)) {
      throw new MalformedEvaluationError(field)
    }
  }

  return raw
}
