import { Type, type Static } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const UpdateTimeZoneBodySchema = Type.Object(
  { timeZone: Type.String({ minLength: 1, maxLength: 64 }) },
  { additionalProperties: false },
)

export type UpdateTimeZoneBody = Static<typeof UpdateTimeZoneBodySchema>

export const UpdateTimeZoneResponseSchema = successSchema(
  Type.Object({ timeZone: Type.String() }, { additionalProperties: false }),
)
