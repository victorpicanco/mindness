import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const SessionThemeCategoriesQuerySchema = Type.Object({}, { additionalProperties: false })

export type SessionThemeCategoriesQuery = Static<typeof SessionThemeCategoriesQuerySchema>

export const SessionThemeCategoriesResponseSchema = successSchema(
  Type.Array(
    Type.Object(
      {
        categoryId: Type.String({ format: 'uuid' }),
        slug: Type.String(),
        name: Type.String(),
      },
      { additionalProperties: false },
    ),
  ),
)
