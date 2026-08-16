import { Type, type Static } from '@fastify/type-provider-typebox'

export const GoogleCallbackQuerySchema = Type.Union([
  Type.Object(
    { code: Type.String({ minLength: 1, maxLength: 4096 }) },
    { additionalProperties: false },
  ),
  Type.Object(
    { error: Type.String({ minLength: 1, maxLength: 256 }) },
    { additionalProperties: false },
  ),
])

export type GoogleCallbackQuery = Static<typeof GoogleCallbackQuerySchema>
