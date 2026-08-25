import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const SessionHistoryQuerySchema = Type.Object(
  { cursor: Type.Optional(Type.String({ format: 'uuid' })) },
  { additionalProperties: false },
)

export type SessionHistoryQuery = Static<typeof SessionHistoryQuerySchema>

const SessionHistoryItemSchema = Type.Object(
  {
    sessionId: Type.String({ format: 'uuid' }),
    startedAt: Type.String({ format: 'date-time' }),
    localDate: Type.String(),
    localTime: Type.String(),
    categorySlug: Type.String(),
    themeTitle: Type.Union([Type.String(), Type.Null()]),
    difficulty: Type.Union([Type.Literal('easy'), Type.Literal('balanced'), Type.Literal('hard')]),
    totalScore: Type.Union([Type.Integer({ minimum: 0, maximum: 100 }), Type.Null()]),
    state: Type.Union([
      Type.Literal('in_progress'),
      Type.Literal('expired'),
      Type.Literal('processing'),
      Type.Literal('completed'),
      Type.Literal('failed'),
    ]),
    bestOfDay: Type.Boolean(),
  },
  { additionalProperties: false },
)

export const SessionHistoryResponseSchema = successSchema(
  Type.Array(SessionHistoryItemSchema),
  Type.Object(
    {
      nextCursor: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
      pageSize: Type.Integer(),
      timeZone: Type.String(),
    },
    { additionalProperties: false },
  ),
)
