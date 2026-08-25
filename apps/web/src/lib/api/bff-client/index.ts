import type { z } from 'zod'

import { ApiClientError } from '@/lib/api/client-error'
import { errorEnvelopeSchema, successEnvelopeSchema } from '@/lib/api/contracts/envelopes'

type Fetcher = typeof fetch

type BffFetchOptions<TSchema extends z.ZodType> = RequestInit & {
  readonly fetcher?: Fetcher
  readonly schema: TSchema
}

function invalidResponse(cause: unknown): ApiClientError {
  return new ApiClientError({
    cause,
    code: 'web.API_RESPONSE_INVALID',
    issues: null,
    message: 'The API returned an invalid response.',
    requestId: null,
  })
}

export async function bffFetch<TSchema extends z.ZodType>(
  path: string,
  { fetcher = fetch, schema, ...init }: BffFetchOptions<TSchema>,
): Promise<z.output<TSchema>> {
  let response: Response

  try {
    response = await fetcher(new URL(`/api/bff${path}`, window.location.origin), init)
  } catch (cause: unknown) {
    throw new ApiClientError({
      cause,
      code: 'web.API_REQUEST_FAILED',
      issues: null,
      message: 'Unable to reach the API.',
      requestId: null,
    })
  }

  let body: unknown

  try {
    body = await response.json()
  } catch (cause: unknown) {
    throw invalidResponse(cause)
  }

  try {
    if (!response.ok) {
      throw new ApiClientError(errorEnvelopeSchema.parse(body).error)
    }

    return schema.parse(successEnvelopeSchema.parse(body).data)
  } catch (cause: unknown) {
    if (cause instanceof ApiClientError) throw cause

    throw invalidResponse(cause)
  }
}
