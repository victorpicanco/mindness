import 'server-only'

import { cookies } from 'next/headers'
import type { z } from 'zod'

import { ApiClientError } from '@/lib/api/client-error'
import { errorEnvelopeSchema, successEnvelopeSchema } from '@/lib/api/contracts/envelopes'
import { EnvironmentError } from '@/lib/env/errors'
import { readServerEnv } from '@/lib/env/server'
import { readSessionCookies } from '@/lib/auth/session'

type CookieStore = Parameters<typeof readSessionCookies>[0]
type Fetcher = typeof fetch

type ApiRequestOptions = Omit<RequestInit, 'headers'> & {
  readonly cookieStore?: CookieStore
  readonly fetcher?: Fetcher
  readonly headers?: HeadersInit
}

type ApiFetchOptions<TSchema extends z.ZodType> = ApiRequestOptions & {
  readonly schema: TSchema
}

type PublicApiFetchOptions<TSchema extends z.ZodType> = Omit<
  ApiFetchOptions<TSchema>,
  'cookieStore'
>

function apiUrl(path: string): string {
  return new URL(path, readServerEnv().API_BASE_URL).toString()
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

function requestApi(
  fetcher: Fetcher,
  path: string,
  init: RequestInit,
  accessToken: string | undefined,
): Promise<Response> {
  return fetcher(apiUrl(path), {
    ...init,
    headers: withAuthorization(init.headers, accessToken),
  })
}

type ApiFetchWithMetaOptions<
  TSchema extends z.ZodType,
  TMetaSchema extends z.ZodType,
> = ApiFetchOptions<TSchema> & { readonly metaSchema: TMetaSchema }

interface ApiResponse<TData, TMeta> {
  readonly data: TData
  readonly meta: TMeta
}

export async function apiFetchWithMeta<TSchema extends z.ZodType, TMetaSchema extends z.ZodType>(
  path: string,
  { metaSchema, schema, ...request }: ApiFetchWithMetaOptions<TSchema, TMetaSchema>,
): Promise<ApiResponse<z.output<TSchema>, z.output<TMetaSchema>>> {
  const envelope = await authenticatedRequestEnvelope(path, request)

  return parseEnvelope(() => ({
    data: schema.parse(envelope.data),
    meta: metaSchema.parse(envelope.meta),
  }))
}

export async function apiFetch<TSchema extends z.ZodType>(
  path: string,
  { schema, ...request }: ApiFetchOptions<TSchema>,
): Promise<z.output<TSchema>> {
  const envelope = await authenticatedRequestEnvelope(path, request)

  return parseEnvelope(() => schema.parse(envelope.data))
}

export async function apiFetchIfAuthenticated<TSchema extends z.ZodType>(
  path: string,
  { schema, cookieStore, ...request }: ApiFetchOptions<TSchema>,
): Promise<z.output<TSchema> | null> {
  const store = cookieStore ?? (await cookies())
  const { accessToken } = readSessionCookies(store)

  if (accessToken === undefined) return null

  try {
    return await apiFetch(path, { ...request, cookieStore: store, schema })
  } catch (cause: unknown) {
    if (cause instanceof ApiClientError && cause.code === 'accounts.AUTHENTICATION_REJECTED') {
      return null
    }

    throw cause
  }
}

export async function publicApiFetch<TSchema extends z.ZodType>(
  path: string,
  { schema, ...request }: PublicApiFetchOptions<TSchema>,
): Promise<z.output<TSchema>> {
  const envelope = await requestEnvelope(path, request, undefined)

  return parseEnvelope(() => schema.parse(envelope.data))
}

function parseEnvelope<TResult>(parse: () => TResult): TResult {
  try {
    return parse()
  } catch (cause: unknown) {
    throw new ApiClientError({
      code: 'web.API_RESPONSE_INVALID',
      message: 'The API returned an invalid response.',
      issues: null,
      requestId: null,
      cause,
    })
  }
}

async function authenticatedRequestEnvelope(
  path: string,
  { cookieStore, ...request }: ApiRequestOptions,
): Promise<z.output<typeof successEnvelopeSchema>> {
  const store = cookieStore ?? (await cookies())

  return requestEnvelope(path, request, readSessionCookies(store).accessToken)
}

async function requestEnvelope(
  path: string,
  { fetcher = fetch, headers, ...init }: Omit<ApiRequestOptions, 'cookieStore'>,
  accessToken: string | undefined,
): Promise<z.output<typeof successEnvelopeSchema>> {
  let response: Response
  const requestInit: RequestInit = headers === undefined ? init : { ...init, headers }

  try {
    response = await requestApi(fetcher, path, requestInit, accessToken)
  } catch (cause: unknown) {
    if (cause instanceof EnvironmentError) throw cause

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

    return successEnvelopeSchema.parse(body)
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
