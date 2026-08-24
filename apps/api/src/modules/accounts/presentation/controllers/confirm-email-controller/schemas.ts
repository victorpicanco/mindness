import { Type, type Static } from '@fastify/type-provider-typebox'

export const ConfirmEmailBodySchema = Type.Object(
  {
    tokenHash: Type.String({ minLength: 1, maxLength: 4096 }),
    type: Type.Union([Type.Literal('email'), Type.Literal('recovery')]),
  },
  { additionalProperties: false },
)

export type ConfirmEmailBody = Static<typeof ConfirmEmailBodySchema>
