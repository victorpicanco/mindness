import { Type } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const AccountProfileResponseSchema = successSchema(
  Type.Object(
    {
      accountId: Type.String({ format: 'uuid' }),
      authenticationMethod: Type.Union([Type.Literal('password'), Type.Literal('google')]),
      createdAt: Type.String({ format: 'date-time' }),
      email: Type.String({ format: 'email' }),
      name: Type.Union([Type.String(), Type.Null()]),
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
