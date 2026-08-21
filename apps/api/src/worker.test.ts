import { describe, expect, it } from 'vitest'

import { BaseError } from '@/shared/errors/base-error/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

import {
  closeAnalysisWorker,
  createAnalysisWorker,
  registerExpiredSessionSweep,
  SWEEP_INTERVAL_MS,
} from './worker.js'

class FakeAnalysisDeadlineExceededError extends BaseError {
  readonly code = 'analyses.ANALYSIS_DEADLINE_EXCEEDED'
  readonly httpStatus = 422
}

describe('registerExpiredSessionSweep', () => {
  it('registers the configured interval and continues after a failed sweep', async () => {
    let registeredCallback: (() => void) | undefined
    let registeredInterval: number | undefined
    let executions = 0
    let stopped = false
    const loggedErrors: unknown[] = []

    const stopSweep = registerExpiredSessionSweep({
      sweepExpiredSessions: {
        execute: async () => {
          await Promise.resolve()
          executions += 1
          if (executions === 1) throw new DatabaseError('Sweep failed')
          return { expiredCount: 0 }
        },
      },
      logger: {
        error: ({ err }) => {
          loggedErrors.push(err)
        },
      },
      schedule: (callback, interval) => {
        registeredCallback = callback
        registeredInterval = interval
        return () => {
          stopped = true
        }
      },
    })

    expect(registeredInterval).toBe(SWEEP_INTERVAL_MS)

    registeredCallback?.()
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(executions).toBe(1)
    expect(loggedErrors).toHaveLength(1)

    registeredCallback?.()
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(executions).toBe(2)

    stopSweep()
    expect(stopped).toBe(true)
  })
})

describe('createAnalysisWorker', () => {
  it('creates the worker with the concurrency from config', () => {
    let capturedConcurrency: number | undefined

    createAnalysisWorker({
      processSessionAudio: { execute: () => Promise.resolve() },
      concurrency: 7,
      createWorker: (_processor, options) => {
        capturedConcurrency = options.concurrency
        return { close: () => Promise.resolve() }
      },
    })

    expect(capturedConcurrency).toBe(7)
  })

  it('translates AnalysisDeadlineExceededError into UnrecoverableError so BullMQ does not retry', async () => {
    let capturedProcessor:
      ((job: { readonly data: { readonly sessionId: string } }) => Promise<void>) | undefined

    createAnalysisWorker({
      processSessionAudio: {
        execute: () => Promise.reject(new FakeAnalysisDeadlineExceededError('Deadline exceeded')),
      },
      concurrency: 1,
      createWorker: (processor) => {
        capturedProcessor = processor
        return { close: () => Promise.resolve() }
      },
    })

    await expect(capturedProcessor?.({ data: { sessionId: 'session-1' } })).rejects.toMatchObject({
      name: 'UnrecoverableError',
    })
  })

  it('rethrows any other error unchanged so BullMQ retries up to attempts', async () => {
    let capturedProcessor:
      ((job: { readonly data: { readonly sessionId: string } }) => Promise<void>) | undefined
    const originalError = new DatabaseError('Connection lost')

    createAnalysisWorker({
      processSessionAudio: { execute: () => Promise.reject(originalError) },
      concurrency: 1,
      createWorker: (processor) => {
        capturedProcessor = processor
        return { close: () => Promise.resolve() }
      },
    })

    await expect(capturedProcessor?.({ data: { sessionId: 'session-1' } })).rejects.toBe(
      originalError,
    )
  })
})

describe('closeAnalysisWorker', () => {
  it('closes the worker before disconnecting the Redis connection', async () => {
    const calls: string[] = []

    await closeAnalysisWorker(
      { close: () => Promise.resolve().then(() => void calls.push('worker')) },
      { disconnect: () => void calls.push('redis') },
    )

    expect(calls).toEqual(['worker', 'redis'])
  })
})
