import { Type } from '@fastify/type-provider-typebox'

import { successSchema } from '@/shared/http/envelope/index.js'

export const SessionIdParamsSchema = Type.Object(
  { sessionId: Type.String({ format: 'uuid' }) },
  { additionalProperties: false },
)

export type SessionIdParams = { readonly sessionId: string }

export const ConfirmAudioUploadResponseSchema = successSchema(Type.Null())
