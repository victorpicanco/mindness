import { describe, expect, it } from 'vitest'

import { DatabaseError } from '@/shared/errors/database-error/index.js'

import { registerExpiredSessionSweep, SWEEP_INTERVAL_MS } from './worker.js'

describe('registerExpiredSessionSweep', () => {
  it('registers the configured interval and continues after a failed sweep', async () => {
    let registeredCallback: (() => void) | undefined
    let registeredInterval: number | undefined
    let executions = 0
    const loggedErrors: unknown[] = []

    registerExpiredSessionSweep({
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
  })
})
