import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

const NAME_MAX_LENGTH = 40

export const UpdateAccountNameBodySchema = Type.Object(
  { name: Type.String({ minLength: 1, maxLength: NAME_MAX_LENGTH }) },
  { additionalProperties: false },
)

export type UpdateAccountNameBody = Static<typeof UpdateAccountNameBodySchema>

export const UpdateAccountNameResponseSchema = successSchema(
  Type.Object({ name: Type.String() }, { additionalProperties: false }),
)
