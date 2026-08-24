import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const UpdatePasswordBodySchema = Type.Object(
  { password: Type.String({ minLength: 8, maxLength: 64 }) },
  { additionalProperties: false },
)
export type UpdatePasswordBody = Static<typeof UpdatePasswordBodySchema>
export const AuthMessageResponseSchema = successSchema(
  Type.Object({ message: Type.String() }, { additionalProperties: false }),
)
