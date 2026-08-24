import 'server-only' // server-only

import { cookies } from 'next/headers'
import { z } from 'zod'

import { readSessionCookies } from '@/lib/auth/session'

import type { ApiErrorDetails, ApiFieldIssue } from './api-error'

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    issues: z
      .array(
        z.object({
          field: z.string(),
          message: z.string(),
        }),
      )
      .nullable(),
    requestId: z.string(),
  }),
})

const successEnvelopeSchema = z.object({
  data: z.unknown(),
  meta: z.unknown().optional(),
})

type CookieStore = Parameters<typeof readSessionCookies>[0]
type Fetcher = typeof fetch

type ApiFetchOptions<TSchema extends z.ZodType> = Omit<RequestInit, 'headers'> & {
  readonly cookieStore?: CookieStore
  readonly fetcher?: Fetcher
  readonly headers?: HeadersInit
  readonly schema: TSchema
}

type ApiClientErrorOptions = ApiErrorDetails & {
  readonly message: string
  readonly cause?: unknown
}

export class ApiClientError extends Error {
  readonly code: string
  readonly issues: readonly ApiFieldIssue[] | null
  readonly requestId: string | null

  constructor({ code, message, issues, requestId, cause }: ApiClientErrorOptions) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'ApiClientError'
    this.code = code
    this.issues = issues
    this.requestId = requestId
  }
}

function apiUrl(path: string): string {
  const baseUrl = process.env.API_BASE_URL

  if (baseUrl === undefined) {
    throw new ApiClientError({
      code: 'web.API_BASE_URL_MISSING',
      message: 'The API base URL is not configured.',
      issues: null,
      requestId: null,
    })
  }

  return new URL(path, baseUrl).toString()
}

function withAuthorization(
  headers: HeadersInit | undefined,
  accessToken: string | undefined,
): Headers {
  const authorizedHeaders = new Headers(headers)

  if (accessToken !== undefined) {
    authorizedHeaders.set('Authorization', `Bearer ${accessToken}`)
  }

  return authorizedHeaders
}

export async function apiFetch<TSchema extends z.ZodType>(
  path: string,
  { cookieStore, fetcher = fetch, headers, schema, ...init }: ApiFetchOptions<TSchema>,
): Promise<z.output<TSchema>> {
  const store = cookieStore ?? (await cookies())
  const { accessToken } = readSessionCookies(store)
  let response: Response

  try {
    response = await fetcher(apiUrl(path), {
      ...init,
      headers: withAuthorization(headers, accessToken),
    })
  } catch (cause: unknown) {
    throw new ApiClientError({
      code: 'web.API_REQUEST_FAILED',
      message: 'Unable to reach the API.',
      issues: null,
      requestId: null,
      cause,
    })
  }

  let body: unknown

  try {
    body = await response.json()
  } catch (cause: unknown) {
    throw new ApiClientError({
      code: 'web.API_RESPONSE_INVALID',
      message: 'The API returned an invalid response.',
      issues: null,
      requestId: null,
      cause,
    })
  }

  try {
    if (!response.ok) {
      const { error } = errorEnvelopeSchema.parse(body)

      throw new ApiClientError({ ...error, requestId: error.requestId })
    }

    const { data } = successEnvelopeSchema.parse(body)

    return schema.parse(data)
  } catch (cause: unknown) {
    if (cause instanceof ApiClientError) throw cause

    throw new ApiClientError({
      code: 'web.API_RESPONSE_INVALID',
      message: 'The API returned an invalid response.',
      issues: null,
      requestId: null,
      cause,
    })
  }
}
