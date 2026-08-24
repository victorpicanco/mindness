import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

import { registerErrorHandler } from '@/shared/http/error-handler/index.js'

import { registerAuthRateLimit } from './index.js'

function errorRequestId(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null
  const { error } = body
  if (typeof error !== 'object' || error === null || !('requestId' in error)) return null

  return error.requestId
}

async function buildRateLimitedApp(max: number) {
  const app = Fastify()
  registerErrorHandler(app)
  await registerAuthRateLimit(app, { max, timeWindowMs: 60_000 })
  app.post('/auth/sign-in', { config: { rateLimit: {} } }, () => ({ data: { ok: true } }))
  app.post('/accounts', () => ({ data: { ok: true } }))
  await app.ready()

  return app
}

describe('registerAuthRateLimit', () => {
  it('answers with the shared error envelope once the window is exhausted', async () => {
    const app = await buildRateLimitedApp(2)

    await app.inject({ method: 'POST', url: '/auth/sign-in' })
    await app.inject({ method: 'POST', url: '/auth/sign-in' })
    const throttled = await app.inject({ method: 'POST', url: '/auth/sign-in' })

    expect(throttled.statusCode).toBe(429)
    expect(throttled.json()).toMatchObject({
      error: { code: 'accounts.RATE_LIMITED', issues: null },
    })
    const body: unknown = throttled.json()
    expect(errorRequestId(body)).toEqual(expect.any(String))

    await app.close()
  })

  it('leaves routes that did not opt in untouched', async () => {
    const app = await buildRateLimitedApp(1)

    await app.inject({ method: 'POST', url: '/accounts' })
    const second = await app.inject({ method: 'POST', url: '/accounts' })

    expect(second.statusCode).toBe(200)

    await app.close()
  })
})
