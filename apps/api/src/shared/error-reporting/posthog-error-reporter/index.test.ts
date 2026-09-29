import { describe, expect, it } from 'vitest'

import { DatabaseError } from '@/shared/errors/database-error/index.js'

import { createErrorReporter } from './index.js'
import type { ErrorTrackingClient } from './index.js'

interface CapturedException {
  readonly error: unknown
  readonly distinctId: string | undefined
  readonly properties: Record<string | number, unknown> | undefined
}

function createFakeClient(): {
  readonly client: ErrorTrackingClient
  readonly captured: CapturedException[]
  readonly shutdowns: () => number
} {
  const captured: CapturedException[] = []
  let shutdowns = 0

  return {
    client: {
      captureException: (error, distinctId, properties) => {
        captured.push({ error, distinctId, properties })
      },
      shutdown: () => {
        shutdowns += 1
        return Promise.resolve()
      },
    },
    captured,
    shutdowns: () => shutdowns,
  }
}

describe('createErrorReporter', () => {
  it('captures a BaseError with its code and context next to the given properties', () => {
    const fake = createFakeClient()
    const reporter = createErrorReporter({
      projectToken: 'phc_test',
      host: 'https://us.i.posthog.com',
      createClient: () => fake.client,
    })
    const error = new DatabaseError('Connection lost', { context: { table: 'sessions' } })

    reporter.report(error, { session_id: 'session-1' })

    expect(fake.captured).toEqual([
      {
        error,
        distinctId: undefined,
        properties: {
          session_id: 'session-1',
          error_code: 'shared.DATABASE_ERROR',
          error_context: { table: 'sessions' },
        },
      },
    ])
  })

  it('captures a non-BaseError with only the given properties', () => {
    const fake = createFakeClient()
    const reporter = createErrorReporter({
      projectToken: 'phc_test',
      host: null,
      createClient: () => fake.client,
    })
    const error = new TypeError('boom')

    reporter.report(error, { session_id: 'session-1' })

    expect(fake.captured).toEqual([
      { error, distinctId: undefined, properties: { session_id: 'session-1' } },
    ])
  })

  it('passes the token and host to the client factory', () => {
    const received: unknown[] = []

    createErrorReporter({
      projectToken: 'phc_test',
      host: 'https://eu.i.posthog.com',
      createClient: (projectToken, host) => {
        received.push({ projectToken, host })
        return createFakeClient().client
      },
    })

    expect(received).toEqual([{ projectToken: 'phc_test', host: 'https://eu.i.posthog.com' }])
  })

  it('flushes the client on shutdown', async () => {
    const fake = createFakeClient()
    const reporter = createErrorReporter({
      projectToken: 'phc_test',
      host: null,
      createClient: () => fake.client,
    })

    await reporter.shutdown()

    expect(fake.shutdowns()).toBe(1)
  })

  it('creates no client and reports nothing without a project token', async () => {
    let created = false
    const reporter = createErrorReporter({
      projectToken: null,
      host: null,
      createClient: () => {
        created = true
        return createFakeClient().client
      },
    })

    reporter.report(new TypeError('boom'), { session_id: 'session-1' })
    await reporter.shutdown()

    expect(created).toBe(false)
  })
})
