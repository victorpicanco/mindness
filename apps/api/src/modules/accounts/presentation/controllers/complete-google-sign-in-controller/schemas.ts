import { Type, type Static } from '@fastify/type-provider-typebox'

export const GoogleCallbackQuerySchema = Type.Object(
  { code: Type.String({ minLength: 1, maxLength: 4096 }) },
  { additionalProperties: true },
)

export type GoogleCallbackQuery = Static<typeof GoogleCallbackQuerySchema>
