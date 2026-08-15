import { Type, type TSchema } from '@fastify/type-provider-typebox'

import type { FieldIssue } from '@/shared/errors/validation-failed-error/index.js'

export interface EnvelopeMeta {
  readonly [key: string]: unknown
}

export interface SuccessEnvelope<T> {
  readonly data: T
  readonly meta?: EnvelopeMeta
}

export interface ErrorBody {
  readonly code: string
  readonly message: string
  readonly issues: FieldIssue[] | null
  readonly requestId: string
}

export interface ErrorEnvelope {
  readonly error: ErrorBody
}

export function ok<T>(data: T, meta?: EnvelopeMeta): SuccessEnvelope<T> {
  return meta === undefined ? { data } : { data, meta }
}

export const ErrorResponseSchema = Type.Object(
  {
    error: Type.Object(
      {
        code: Type.String(),
        message: Type.String(),
        issues: Type.Union([
          Type.Array(
            Type.Object(
              { field: Type.String(), message: Type.String() },
              { additionalProperties: false },
            ),
          ),
          Type.Null(),
        ]),
        requestId: Type.String(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
)

export function successSchema<TData extends TSchema>(data: TData) {
  return Type.Object({ data }, { additionalProperties: false })
}
