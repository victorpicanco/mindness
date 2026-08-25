import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { bffFetch } from '@/lib/api/bff-client'
import type { ApiClientError } from '@/lib/api/client-error'

describe('bffFetch', () => {
  it('calls the BFF and returns validated response data', async () => {
    const requests: Request[] = []

    const result = await bffFetch('/sessions', {
      body: JSON.stringify({ categorySlug: 'focus' }),
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(Response.json({ data: { sessionId: 'session-id' } }))
      },
      method: 'POST',
      schema: z.object({ sessionId: z.string() }),
    })

    expect(result).toEqual({ sessionId: 'session-id' })
    expect(requests[0]?.url).toBe('http://localhost:3000/api/bff/sessions')
    expect(requests[0]?.method).toBe('POST')
  })

  it('preserves a backend error response', async () => {
    const request = bffFetch('/sessions', {
      fetcher: () =>
        Promise.resolve(
          Response.json(
            {
              error: {
                code: 'quota.QUOTA_EXHAUSTED',
                issues: null,
                message: 'The quota is exhausted.',
                requestId: 'request-id',
              },
            },
            { status: 409 },
          ),
        ),
      schema: z.object({ sessionId: z.string() }),
    })

    await expect(request).rejects.toMatchObject({
      code: 'quota.QUOTA_EXHAUSTED',
      message: 'The quota is exhausted.',
      requestId: 'request-id',
    } satisfies Pick<ApiClientError, 'code' | 'message' | 'requestId'>)
  })

  it('translates invalid response data into a client error', async () => {
    const request = bffFetch('/sessions', {
      fetcher: () => Promise.resolve(Response.json({ data: { sessionId: 42 } })),
      schema: z.object({ sessionId: z.string() }),
    })

    await expect(request).rejects.toMatchObject({ code: 'web.API_RESPONSE_INVALID' })
  })

  it('translates network failures into a client error', async () => {
    const request = bffFetch('/sessions', {
      fetcher: () => Promise.reject(new TypeError('network unavailable')),
      schema: z.object({ sessionId: z.string() }),
    })

    await expect(request).rejects.toMatchObject({ code: 'web.API_REQUEST_FAILED' })
  })
})
