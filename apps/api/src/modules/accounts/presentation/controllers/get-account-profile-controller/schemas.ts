import { Type } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

const ConsentSchema = Type.Union([
  Type.Object(
    {
      purpose: Type.Literal('voice_recording_and_analysis'),
      version: Type.String(),
      acceptedAt: Type.String({ format: 'date-time' }),
    },
    { additionalProperties: false },
  ),
  Type.Null(),
])

const SharedProfileProperties = {
  accountId: Type.String({ format: 'uuid' }),
  createdAt: Type.String({ format: 'date-time' }),
  name: Type.Union([Type.String(), Type.Null()]),
  timeZone: Type.String(),
  plan: Type.Literal('free'),
  consent: ConsentSchema,
}

const GuestProfileSchema = Type.Object(
  {
    ...SharedProfileProperties,
    accountKind: Type.Literal('guest'),
    authenticationMethod: Type.Literal('anonymous'),
    email: Type.Null(),
  },
  { additionalProperties: false },
)

const RegisteredProfileSchema = Type.Object(
  {
    ...SharedProfileProperties,
    accountKind: Type.Literal('registered'),
    authenticationMethod: Type.Union([Type.Literal('password'), Type.Literal('google')]),
    email: Type.String({ format: 'email' }),
  },
  { additionalProperties: false },
)

export const AccountProfileResponseSchema = successSchema(
  Type.Union([GuestProfileSchema, RegisteredProfileSchema]),
)
