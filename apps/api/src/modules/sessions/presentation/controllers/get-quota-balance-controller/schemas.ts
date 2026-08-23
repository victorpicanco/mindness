import { Type } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const SessionQuotaResponseSchema = successSchema(
  Type.Union([
    Type.Object(
      {
        enforced: Type.Literal(true),
        allowance: Type.Number({ minimum: 0 }),
        remaining: Type.Number({ minimum: 0 }),
        renewsAt: Type.String({ format: 'date-time' }),
      },
      { additionalProperties: false },
    ),
    Type.Object({ enforced: Type.Literal(false) }, { additionalProperties: false }),
  ]),
)
