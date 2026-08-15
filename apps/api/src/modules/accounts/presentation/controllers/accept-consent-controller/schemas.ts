import { Type } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const AcceptConsentResponseSchema = successSchema(
  Type.Object(
    {
      purpose: Type.Literal('voice_recording_and_analysis'),
      version: Type.String(),
      acceptedAt: Type.String({ format: 'date-time' }),
    },
    { additionalProperties: false },
  ),
)
