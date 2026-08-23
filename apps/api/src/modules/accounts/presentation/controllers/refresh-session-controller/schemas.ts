import { Type, type Static } from '@fastify/type-provider-typebox'

export const RefreshSessionBodySchema = Type.Object(
  { refreshToken: Type.String({ minLength: 1, maxLength: 4096 }) },
  { additionalProperties: false },
)

export type RefreshSessionBody = Static<typeof RefreshSessionBodySchema>
