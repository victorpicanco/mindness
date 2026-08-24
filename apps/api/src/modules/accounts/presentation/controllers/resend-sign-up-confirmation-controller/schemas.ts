import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const ResendSignUpConfirmationBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email', minLength: 3, maxLength: 254 }),
    captchaToken: Type.String({ minLength: 1, maxLength: 4096 }),
  },
  { additionalProperties: false },
)
export type ResendSignUpConfirmationBody = Static<typeof ResendSignUpConfirmationBodySchema>
export const NeutralAuthResponseSchema = successSchema(
  Type.Object({ message: Type.String() }, { additionalProperties: false }),
)
