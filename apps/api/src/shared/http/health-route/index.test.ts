import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

import { registerHealthRoute } from './index.js'

describe('registerHealthRoute', () => {
  it('responds 200 with exactly { status: "ok" }', async () => {
    const app = Fastify()
    registerHealthRoute(app)

    const res = await app.inject({ method: 'GET', url: '/healthz' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })

  it('requires no authentication header', async () => {
    const app = Fastify()
    registerHealthRoute(app)

    const res = await app.inject({ method: 'GET', url: '/healthz' })

    expect(res.statusCode).toBe(200)
  })
})
