import { Type } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const DeleteAccountResponseSchema = successSchema(
  Type.Object(
    { scheduledFor: Type.String({ format: 'date-time' }) },
    { additionalProperties: false },
  ),
)
