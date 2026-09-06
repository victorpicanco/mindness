import { Type, type Static } from '@fastify/type-provider-typebox'

import { DeliveryFeedbackSchema } from './delivery-schema.js'

import { successSchema } from '@/shared/http/envelope/index.js'

const FeedbackPointSchema = Type.Object(
  { title: Type.String(), evidence: Type.String() },
  { additionalProperties: false },
)

export const SessionIdParamsSchema = Type.Object(
  { sessionId: Type.String({ format: 'uuid' }) },
  { additionalProperties: false },
)

export type SessionIdParams = Static<typeof SessionIdParamsSchema>

export const SessionAnalysisResponseSchema = successSchema(
  Type.Object(
    {
      sessionId: Type.String({ format: 'uuid' }),
      feedback: Type.Object(
        {
          summary: Type.String(),
          delivery: Type.Optional(DeliveryFeedbackSchema),
          strengths: Type.Array(FeedbackPointSchema, { maxItems: 3 }),
          improvements: Type.Array(
            Type.Object(
              { title: Type.String(), evidence: Type.String(), action: Type.String() },
              { additionalProperties: false },
            ),
            { maxItems: 3 },
          ),
        },
        { additionalProperties: false },
      ),
      transcript: Type.String(),
      analyzedAt: Type.String({ format: 'date-time' }),
    },
    { additionalProperties: false },
  ),
)
