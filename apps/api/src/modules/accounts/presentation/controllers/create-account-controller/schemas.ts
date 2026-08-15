import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

// RF-001: only the browser time zone is accepted here. Identity, plan and account id are
// derived from the validated token, never from the request body.
export const CreateAccountBodySchema = Type.Object(
  { timeZone: Type.Union([Type.String({ minLength: 1, maxLength: 64 }), Type.Null()]) },
  { additionalProperties: false },
)

export type CreateAccountBody = Static<typeof CreateAccountBodySchema>

export const CreateAccountResponseSchema = successSchema(
  Type.Object({ message: Type.String() }, { additionalProperties: false }),
)
