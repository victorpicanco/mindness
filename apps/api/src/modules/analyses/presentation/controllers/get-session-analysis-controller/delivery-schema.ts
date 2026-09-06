import { Type } from '@fastify/type-provider-typebox'

const closed = { additionalProperties: false } as const
const seconds = () => Type.Number({ minimum: 0, maximum: 60 })
const count = () => Type.Integer({ minimum: 0 })

export const DeliveryFeedbackSchema = Type.Object(
  {
    version: Type.Literal(2),
    promptVersion: Type.Literal('speech-feedback-v2'),
    model: Type.String(),
    audioQuality: Type.Union([
      Type.Literal('usable'),
      Type.Literal('limited'),
      Type.Literal('unusable'),
    ]),
    limitations: Type.Array(Type.String(), { maxItems: 5 }),
    metrics: Type.Object(
      {
        durationSeconds: Type.Number({ exclusiveMinimum: 0, maximum: 60 }),
        wordCount: count(),
        wordsPerMinute: Type.Union([count(), Type.Null()]),
        windows: Type.Array(
          Type.Object(
            {
              startSeconds: seconds(),
              endSeconds: seconds(),
              wordCount: count(),
              wordsPerMinute: count(),
            },
            closed,
          ),
          { maxItems: 6 },
        ),
      },
      closed,
    ),
    fillers: Type.Object(
      {
        status: Type.Union([
          Type.Literal('assessed'),
          Type.Literal('partial'),
          Type.Literal('unavailable'),
        ]),
        total: Type.Union([count(), Type.Null()]),
        perMinute: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
        byExpression: Type.Array(
          Type.Object({ expression: Type.String(), count: Type.Integer({ minimum: 1 }) }, closed),
          { maxItems: 120 },
        ),
        occurrences: Type.Array(
          Type.Object(
            {
              expression: Type.String(),
              startSeconds: seconds(),
              endSeconds: seconds(),
              quote: Type.String(),
              confidence: Type.Union([Type.Literal('high'), Type.Literal('medium')]),
            },
            closed,
          ),
          { maxItems: 120 },
        ),
      },
      closed,
    ),
    moments: Type.Array(
      Type.Object(
        {
          startSeconds: seconds(),
          endSeconds: seconds(),
          kind: Type.Union(
            (['pace', 'pause', 'articulation', 'structure', 'repetition', 'delivery'] as const).map(
              (kind) => Type.Literal(kind),
            ),
          ),
          quote: Type.String(),
          observation: Type.String(),
          impact: Type.String(),
          action: Type.String(),
        },
        closed,
      ),
      { maxItems: 8 },
    ),
    nextPractice: Type.Union([
      Type.Object(
        { focus: Type.String(), exercise: Type.String(), successCriterion: Type.String() },
        closed,
      ),
      Type.Null(),
    ]),
  },
  closed,
)
