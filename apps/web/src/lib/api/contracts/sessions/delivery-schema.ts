import { z } from 'zod'

const seconds = z.number().min(0).max(60)
const count = z.number().int().nonnegative()
const text = z.string().min(1)

export const deliveryFeedbackSchema = z.strictObject({
  version: z.literal(2),
  promptVersion: z.literal('speech-feedback-v2'),
  model: text,
  audioQuality: z.enum(['usable', 'limited', 'unusable']),
  limitations: z.array(text).max(5),
  metrics: z.strictObject({
    durationSeconds: z.number().positive().max(60),
    wordCount: count,
    wordsPerMinute: count.nullable(),
    windows: z
      .array(
        z.strictObject({
          startSeconds: seconds,
          endSeconds: seconds,
          wordCount: count,
          wordsPerMinute: count,
        }),
      )
      .max(6),
  }),
  fillers: z.strictObject({
    status: z.enum(['assessed', 'partial', 'unavailable']),
    total: count.nullable(),
    perMinute: z.number().nonnegative().nullable(),
    byExpression: z
      .array(z.strictObject({ expression: text, count: z.number().int().positive() }))
      .max(120),
    occurrences: z
      .array(
        z.strictObject({
          expression: text,
          startSeconds: seconds,
          endSeconds: seconds,
          quote: text,
          confidence: z.enum(['high', 'medium']),
        }),
      )
      .max(120),
  }),
  moments: z
    .array(
      z.strictObject({
        startSeconds: seconds,
        endSeconds: seconds,
        kind: z.enum(['pace', 'pause', 'articulation', 'structure', 'repetition', 'delivery']),
        quote: text,
        observation: text,
        impact: text,
        action: text,
      }),
    )
    .max(8),
  nextPractice: z.strictObject({ focus: text, exercise: text, successCriterion: text }).nullable(),
})
