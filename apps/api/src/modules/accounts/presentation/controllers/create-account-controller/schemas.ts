import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const CreateAccountBodySchema = Type.Object(
  { timeZone: Type.Union([Type.String({ minLength: 1, maxLength: 64 }), Type.Null()]) },
  { additionalProperties: false },
)

export type CreateAccountBody = Static<typeof CreateAccountBodySchema>

export const CreateAccountResponseSchema = successSchema(
  Type.Object({ message: Type.String() }, { additionalProperties: false }),
)
