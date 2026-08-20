import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const SessionIdParamsSchema = Type.Object(
  { sessionId: Type.String({ format: 'uuid' }) },
  { additionalProperties: false },
)

export type SessionIdParams = Static<typeof SessionIdParamsSchema>

export const AbandonSessionResponseSchema = successSchema(Type.Null())
