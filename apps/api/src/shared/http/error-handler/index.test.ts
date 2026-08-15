import { Type } from '@fastify/type-provider-typebox'
import pino from 'pino'
import { describe, expect, it } from 'vitest'

import { DatabaseError } from '@/shared/errors/database-error/index.js'
import { NotFoundError } from '@/shared/errors/categories/not-found-error/index.js'
import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'

class TestNotFoundError extends NotFoundError {
  readonly code = 'test.NOT_FOUND'
}

interface ErrorBody {
  readonly code: string
  readonly message: string
  readonly issues: unknown
  readonly requestId: string
}

interface ErrorEnvelope {
  readonly error: ErrorBody
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isErrorBody(value: unknown): value is ErrorBody {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.message === 'string' &&
    typeof value.requestId === 'string' &&
    'issues' in value
  )
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return isRecord(value) && isErrorBody(value.error)
}

function parseErrorEnvelope(body: unknown): ErrorEnvelope {
  if (!isErrorEnvelope(body)) throw new TypeError('expected an error envelope response body')
  return body
}

function createTestApp() {
  const app = buildApp({ logger: pino({ level: 'silent' }) })

  app.get('/not-found', () => {
    throw new TestNotFoundError('Resource not found')
  })

  app.get('/validation-failed', () => {
    throw new ValidationFailedError([{ field: 'name', message: 'Name is required' }])
  })

  app.get('/database-error', () => {
    throw new DatabaseError('Query failed', {
      cause: new TypeError('relation "users" does not exist'),
    })
  })

  app.get('/type-error', () => {
    throw new TypeError('Cannot read property of undefined')
  })

  app.post('/schema-validated', { schema: { body: Type.Object({ name: Type.String() }) } }, () => ({
    ok: true,
  }))

  return app
}

describe('registerErrorHandler', () => {
  it('maps a NotFoundError subclass to 404 with its code, message and a requestId', async () => {
    const app = createTestApp()
    const res = await app.inject({ method: 'GET', url: '/not-found' })
    const body = parseErrorEnvelope(res.json())

    expect(res.statusCode).toBe(404)
    expect(body.error.code).toBe('test.NOT_FOUND')
    expect(body.error.message).toBe('Resource not found')
    expect(body.error.requestId.length).toBeGreaterThan(0)
  })

  it('maps a ValidationFailedError to 400 with an issues array', async () => {
    const app = createTestApp()
    const res = await app.inject({ method: 'GET', url: '/validation-failed' })
    const body = parseErrorEnvelope(res.json())

    expect(res.statusCode).toBe(400)
    expect(body.error.issues).toEqual([{ field: 'name', message: 'Name is required' }])
  })

  it('maps a DatabaseError to a generic 500 without leaking the driver cause', async () => {
    const app = createTestApp()
    const res = await app.inject({ method: 'GET', url: '/database-error' })
    const body = parseErrorEnvelope(res.json())

    expect(res.statusCode).toBe(500)
    expect(body.error.code).toBe('shared.INTERNAL_ERROR')
    expect(body.error).not.toHaveProperty('stack')
    expect(res.body).not.toContain('relation "users" does not exist')
  })

  it('maps a raw TypeError to the same generic 500 without leaking the stack', async () => {
    const app = createTestApp()
    const res = await app.inject({ method: 'GET', url: '/type-error' })
    const body = parseErrorEnvelope(res.json())

    expect(res.statusCode).toBe(500)
    expect(body.error.code).toBe('shared.INTERNAL_ERROR')
    expect(body.error).not.toHaveProperty('stack')
    expect(res.body).not.toContain('Cannot read property of undefined')
  })

  it('translates a Fastify schema validation failure into the same issues format', async () => {
    const app = createTestApp()
    const res = await app.inject({ method: 'POST', url: '/schema-validated', payload: {} })
    const body = parseErrorEnvelope(res.json())

    expect(res.statusCode).toBe(400)
    expect(Array.isArray(body.error.issues)).toBe(true)
    if (!Array.isArray(body.error.issues)) throw new TypeError('expected issues to be an array')
    expect(body.error.issues[0]).toMatchObject({ field: 'name' })
  })
})
