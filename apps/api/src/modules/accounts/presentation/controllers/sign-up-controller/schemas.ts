import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const SignUpBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email', minLength: 3, maxLength: 254 }),
    password: Type.String({ minLength: 12, maxLength: 64 }),
    captchaToken: Type.String({ minLength: 1, maxLength: 4096 }),
  },
  { additionalProperties: false },
)

export type SignUpBody = Static<typeof SignUpBodySchema>

export const SignUpResponseSchema = successSchema(
  Type.Object({ message: Type.String() }, { additionalProperties: false }),
)
