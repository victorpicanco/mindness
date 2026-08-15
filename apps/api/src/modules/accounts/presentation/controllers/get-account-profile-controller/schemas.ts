import { Type } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const AccountProfileResponseSchema = successSchema(
  Type.Object(
    {
      accountId: Type.String({ format: 'uuid' }),
      email: Type.String({ format: 'email' }),
      timeZone: Type.String(),
      plan: Type.Literal('free'),
      consent: Type.Union([
        Type.Object(
          {
            purpose: Type.Literal('voice_recording_and_analysis'),
            version: Type.String(),
            acceptedAt: Type.String({ format: 'date-time' }),
          },
          { additionalProperties: false },
        ),
        Type.Null(),
      ]),
    },
    { additionalProperties: false },
  ),
)
