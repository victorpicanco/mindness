import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'

import { GetActiveSessionUseCase } from './index.js'

const NOW = new Date('2026-08-19T00:00:00.000Z')

function createSession(createdAt: Date): Session {
  return Session.start({
    sessionId: 'session-1',
    accountId: 'account-1',
    themeId: 'theme-1',
    configuration: SessionConfiguration.create({
      difficulty: 'balanced',
      categorySlug: 'communication',
      searchWindowMinutes: 5,
    }),
    quotaReservationId: 'reservation-1',
    createdAt,
  })
}

function createHarness(activeSession: Session | null) {
  const saved: Session[] = []
  const releasedSessionIds: string[] = []
  const events = new FakeEventBus()
  let transactionRuns = 0
  const sessions: SessionsRepository = {
    findById: () => Promise.resolve(activeSession),
    findActiveByAccountId: () => Promise.resolve(activeSession),
    listByAccount: () => Promise.resolve([]),
    findCompletedBetween: () => Promise.resolve([]),
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    markDeleted: () => Promise.resolve(true),
    save: (session) => {
      saved.push(session)
      return Promise.resolve()
    },
  }
  const quota: QuotaPort = {
    readBalance: () => Promise.resolve({ enforced: false }),
    reserveForSession: () =>
      Promise.resolve({ reservationId: 'reservation-2', enforced: true, remaining: 3 }),
    releaseReservation: ({ sessionId }) => {
      releasedSessionIds.push(sessionId)
      return Promise.resolve()
    },
  }
  const useCase = new GetActiveSessionUseCase({
    sessions,
    quota,
    clock: { now: () => NOW },
    eventPublisher: events,
    idGenerator: { generate: () => 'event-1' },
    unitOfWork: {
      run: (operation) => {
        transactionRuns += 1
        return operation()
      },
    },
  })

  return { events, releasedSessionIds, saved, transactionRuns: () => transactionRuns, useCase }
}

describe('GetActiveSessionUseCase', () => {
  it('returns the unexpired active session data without leaking its entity', async () => {
    const harness = createHarness(createSession(new Date('2026-08-18T23:50:00.000Z')))

    await expect(harness.useCase.execute({ accountId: 'account-1' })).resolves.toEqual({
      sessionId: 'session-1',
      themeId: 'theme-1',
      configuration: {
        difficulty: 'balanced',
        categorySlug: 'communication',
        searchWindowMinutes: 5,
      },
      createdAt: '2026-08-18T23:50:00.000Z',
      expiresAt: '2026-08-19T00:05:00.000Z',
    })
  })

  it('expires a stale active session and returns null', async () => {
    const harness = createHarness(createSession(new Date('2026-08-18T23:40:00.000Z')))

    await expect(harness.useCase.execute({ accountId: 'account-1' })).resolves.toBeNull()

    expect(harness.saved).toHaveLength(1)
    expect(harness.releasedSessionIds).toEqual(['session-1'])
    expect(harness.transactionRuns()).toBe(1)
    expect(harness.events.published).toContainEqual(
      expect.objectContaining({ eventName: 'session_expired' }),
    )
  })

  it('returns null without changing anything when there is no active session', async () => {
    const harness = createHarness(null)

    await expect(harness.useCase.execute({ accountId: 'account-1' })).resolves.toBeNull()

    expect(harness.saved).toHaveLength(0)
    expect(harness.releasedSessionIds).toHaveLength(0)
    expect(harness.events.published).toHaveLength(0)
    expect(harness.transactionRuns()).toBe(0)
  })
})
