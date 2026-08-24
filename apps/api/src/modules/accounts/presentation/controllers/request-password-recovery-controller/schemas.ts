import { Type, type Static } from '@fastify/type-provider-typebox'

export const RequestPasswordRecoveryBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email', minLength: 3, maxLength: 254 }),
    captchaToken: Type.String({ minLength: 1, maxLength: 4096 }),
  },
  { additionalProperties: false },
)
export type RequestPasswordRecoveryBody = Static<typeof RequestPasswordRecoveryBodySchema>
