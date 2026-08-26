import { Type } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const ActiveSessionResponseSchema = successSchema(
  Type.Union([
    Type.Object(
      {
        sessionId: Type.String({ format: 'uuid' }),
        themeId: Type.String({ format: 'uuid' }),
        themeTitle: Type.String(),
        configuration: Type.Object(
          {
            difficulty: Type.Union([
              Type.Literal('easy'),
              Type.Literal('balanced'),
              Type.Literal('hard'),
            ]),
            categorySlug: Type.String(),
            searchWindowMinutes: Type.Union([Type.Literal(3), Type.Literal(4), Type.Literal(5)]),
          },
          { additionalProperties: false },
        ),
        createdAt: Type.String({ format: 'date-time' }),
        serverNow: Type.String({ format: 'date-time' }),
        researchEndsAt: Type.String({ format: 'date-time' }),
        expiresAt: Type.String({ format: 'date-time' }),
        recordingStartedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    Type.Null(),
  ]),
)
