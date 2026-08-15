import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const SignInBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email', minLength: 3, maxLength: 254 }),
    password: Type.String({ minLength: 1, maxLength: 64 }),
    captchaToken: Type.String({ minLength: 1, maxLength: 4096 }),
  },
  { additionalProperties: false },
)

export type SignInBody = Static<typeof SignInBodySchema>

export const SessionResponseSchema = successSchema(
  Type.Object(
    {
      accessToken: Type.String(),
      refreshToken: Type.String(),
      expiresAt: Type.String({ format: 'date-time' }),
    },
    { additionalProperties: false },
  ),
)
