import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const StartSessionBodySchema = Type.Object(
  {
    difficulty: Type.Union([Type.Literal('easy'), Type.Literal('balanced'), Type.Literal('hard')]),
    categorySlug: Type.String({ minLength: 1 }),
    searchWindowMinutes: Type.Union([Type.Literal(3), Type.Literal(4), Type.Literal(5)]),
  },
  { additionalProperties: false },
)

export type StartSessionBody = Static<typeof StartSessionBodySchema>

export const StartSessionResponseSchema = successSchema(
  Type.Object(
    {
      sessionId: Type.String({ format: 'uuid' }),
      themeId: Type.String({ format: 'uuid' }),
      themeTitle: Type.String(),
      expiresAt: Type.String({ format: 'date-time' }),
      researchEndsAt: Type.String({ format: 'date-time' }),
      remaining: Type.Union([Type.Number(), Type.Null()]),
    },
    { additionalProperties: false },
  ),
)
