import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

const PillarSchema = Type.Integer({ minimum: 0, maximum: 100 })
const PillarNameSchema = Type.Union([
  Type.Literal('clarity'),
  Type.Literal('rhythm'),
  Type.Literal('fluency'),
  Type.Literal('mastery'),
])

export const SessionIdParamsSchema = Type.Object(
  { sessionId: Type.String({ format: 'uuid' }) },
  { additionalProperties: false },
)

export type SessionIdParams = Static<typeof SessionIdParamsSchema>

export const SessionAnalysisResponseSchema = successSchema(
  Type.Object(
    {
      sessionId: Type.String({ format: 'uuid' }),
      scores: Type.Object(
        {
          clarity: PillarSchema,
          rhythm: PillarSchema,
          fluency: PillarSchema,
          mastery: PillarSchema,
          total: PillarSchema,
        },
        { additionalProperties: false },
      ),
      guidance: Type.Array(
        Type.Object(
          { pillar: PillarNameSchema, text: Type.String() },
          { additionalProperties: false },
        ),
        { minItems: 1 },
      ),
      transcript: Type.String(),
      analyzedAt: Type.String({ format: 'date-time' }),
    },
    { additionalProperties: false },
  ),
)
