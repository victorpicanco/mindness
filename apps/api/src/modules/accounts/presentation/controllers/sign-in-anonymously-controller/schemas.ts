import { Type, type Static } from '@fastify/type-provider-typebox'

export const SignInAnonymouslyBodySchema = Type.Object(
  { captchaToken: Type.String({ minLength: 1, maxLength: 4096 }) },
  { additionalProperties: false },
)

export type SignInAnonymouslyBody = Static<typeof SignInAnonymouslyBodySchema>
