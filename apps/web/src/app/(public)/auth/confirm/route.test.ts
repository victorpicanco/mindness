import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmailConfirmationRouteHandler } from './route'

class InMemoryCookieStore {
  readonly values = new Map<string, string>()

  get(name: string): { value: string } | undefined {
    const value = this.values.get(name)
    return value === undefined ? undefined : { value }
  }

  set(name: string, value: string): void {
    this.values.set(name, value)
  }

  delete(name: string): void {
    this.values.delete(name)
  }
}

const session = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: '2026-08-15T13:00:00.000Z',
}

const consent = {
  purpose: 'voice_recording_and_analysis',
  version: '1',
  acceptedAt: '2026-08-15T12:00:00.000Z',
}

function errorResponse(code: string, status: number): Response {
  return Response.json(
    { error: { code, message: 'Rejected', issues: null, requestId: 'request-id' } },
    { status },
  )
}

type RouteResponses = Readonly<Record<string, () => Response>>

function fetcherFor(responses: RouteResponses): { fetcher: typeof fetch; calls: string[] } {
  const calls: string[] = []
  const fetcher: typeof fetch = (input) => {
    const path = new URL(input instanceof Request ? input.url : String(input)).pathname
    calls.push(path)
    const respond = responses[path]
    if (respond === undefined) expect.unreachable(`Unexpected request to ${path}`)

    return Promise.resolve(respond())
  }

  return { fetcher, calls }
}

const provisioningResponses: RouteResponses = {
  '/auth/email/confirm': () => Response.json({ data: session }),
  '/accounts/me': () => errorResponse('accounts.ACCOUNT_NOT_FOUND', 404),
  '/accounts': () => Response.json({ data: { message: 'ok' } }),
  '/accounts/me/consent': () => Response.json({ data: consent }),
}

describe('email confirmation route', () => {
  beforeEach(() => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('exchanges an email token hash, stores the session and redirects without leaking it', async () => {
    const store = new InMemoryCookieStore()
    const { fetcher, calls } = fetcherFor(provisioningResponses)
    const handler = createEmailConfirmationRouteHandler({ cookieStore: store, fetcher })

    const response = await handler(
      new Request('https://web.test/auth/confirm?token_hash=secret-hash&type=email'),
    )

    expect(response.headers.get('location')).toBe('/')
    expect(store.values.get('mindness_access_token')).toBe('access-token')
    expect(response.headers.get('location')).not.toContain('secret-hash')
    expect(calls).toEqual([
      '/auth/email/confirm',
      '/accounts/me',
      '/accounts',
      '/accounts/me/consent',
    ])
  })

  it('sends a confirmed account that cannot be provisioned back to sign-in', async () => {
    const store = new InMemoryCookieStore()
    const { fetcher } = fetcherFor({
      ...provisioningResponses,
      '/accounts': () => errorResponse('accounts.BETA_CAPACITY_REACHED', 403),
    })
    const handler = createEmailConfirmationRouteHandler({ cookieStore: store, fetcher })

    const response = await handler(
      new Request('https://web.test/auth/confirm?token_hash=secret-hash&type=email'),
    )

    expect(response.headers.get('location')).toBe(
      '/auth/sign-in?error=accounts.BETA_CAPACITY_REACHED',
    )
    expect(store.values.get('mindness_access_token')).toBeUndefined()
  })

  it('redirects invalid or already-used links to an explicit error state', async () => {
    const { fetcher } = fetcherFor({
      '/auth/email/confirm': () => errorResponse('accounts.AUTHENTICATION_REJECTED', 401),
    })
    const handler = createEmailConfirmationRouteHandler({
      cookieStore: new InMemoryCookieStore(),
      fetcher,
    })

    const response = await handler(
      new Request('https://web.test/auth/confirm?token_hash=used&type=email'),
    )

    expect(response.headers.get('location')).toBe('/auth/confirmed?status=invalid')
  })

  it('routes a valid recovery link to the password update screen', async () => {
    const { fetcher, calls } = fetcherFor({
      '/auth/email/confirm': () => Response.json({ data: session }),
    })
    const handler = createEmailConfirmationRouteHandler({
      cookieStore: new InMemoryCookieStore(),
      fetcher,
    })

    const response = await handler(
      new Request('https://web.test/auth/confirm?token_hash=recovery&type=recovery'),
    )

    expect(response.headers.get('location')).toBe('/auth/update-password')
    expect(calls).toEqual(['/auth/email/confirm'])
  })
})
