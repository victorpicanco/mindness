import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'

import { SweepExpiredSessionsUseCase } from './index.js'

const NOW = new Date('2026-08-19T00:00:00.000Z')

function createSession(sessionId: string, accountId: string, createdAt: Date): Session {
  return Session.start({
    sessionId,
    accountId,
    themeId: `theme-${sessionId}`,
    configuration: SessionConfiguration.create({
      difficulty: 'easy',
      categorySlug: 'self-awareness',
      searchWindowMinutes: 3,
    }),
    quotaReservationId: `reservation-${sessionId}`,
    createdAt,
  })
}

function createHarness(initialSessions: Session[]) {
  const sessions = [...initialSessions]
  const limits: number[] = []
  const releasedSessionIds: string[] = []
  const events = new FakeEventBus()
  let nextId = 0
  const repository: SessionsRepository = {
    findById: (sessionId) =>
      Promise.resolve(sessions.find((session) => session.id === sessionId) ?? null),
    findActiveByAccountId: () => Promise.resolve(null),
    listByAccount: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    findExpiredInProgress: (before, limit) => {
      limits.push(limit)
      return Promise.resolve(
        sessions
          .filter(
            (session) =>
              session.state === 'in_progress' && session.expiresAt.getTime() <= before.getTime(),
          )
          .slice(0, limit),
      )
    },
    save: () => Promise.resolve(),
  }
  const quota: QuotaPort = {
    reserveForSession: () =>
      Promise.resolve({ reservationId: 'reservation-next', enforced: true, remaining: 3 }),
    releaseReservation: ({ sessionId }) => {
      releasedSessionIds.push(sessionId)
      return Promise.resolve()
    },
  }
  let transactionRuns = 0
  const useCase = new SweepExpiredSessionsUseCase({
    sessions: repository,
    quota,
    clock: { now: () => NOW },
    eventPublisher: events,
    idGenerator: { generate: () => `event-${(nextId += 1)}` },
    unitOfWork: {
      run: (operation) => {
        transactionRuns += 1
        return operation()
      },
    },
    defaultLimit: 3,
  })

  return { events, limits, releasedSessionIds, transactionRuns: () => transactionRuns, useCase }
}

describe('SweepExpiredSessionsUseCase', () => {
  it('expires only the expired in-progress sessions and returns their count', async () => {
    const harness = createHarness([
      createSession('session-1', 'account-1', new Date('2026-08-18T23:40:00.000Z')),
      createSession('session-2', 'account-2', new Date('2026-08-18T23:42:00.000Z')),
      createSession('session-3', 'account-3', new Date('2026-08-18T23:44:00.000Z')),
      createSession('session-4', 'account-4', new Date('2026-08-18T23:50:00.000Z')),
    ])

    await expect(harness.useCase.execute()).resolves.toEqual({ expiredCount: 3 })

    expect(harness.limits).toEqual([3])
    expect(harness.transactionRuns()).toBe(3)
    expect(harness.releasedSessionIds).toEqual(['session-1', 'session-2', 'session-3'])
    expect(harness.events.published).toHaveLength(3)
    expect(harness.events.published.map((event) => event.eventName)).toEqual([
      'session_expired',
      'session_expired',
      'session_expired',
    ])
  })

  it('is idempotent when it runs again after expiring the current page', async () => {
    const harness = createHarness([
      createSession('session-1', 'account-1', new Date('2026-08-18T23:40:00.000Z')),
      createSession('session-2', 'account-2', new Date('2026-08-18T23:42:00.000Z')),
    ])

    await expect(harness.useCase.execute({ limit: 2 })).resolves.toEqual({ expiredCount: 2 })
    await expect(harness.useCase.execute({ limit: 2 })).resolves.toEqual({ expiredCount: 0 })

    expect(harness.limits).toEqual([2, 2])
    expect(harness.releasedSessionIds).toEqual(['session-1', 'session-2'])
  })
})
