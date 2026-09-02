import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'

import { ExpireSessionUseCase } from './index.js'

const NOW = new Date('2026-08-19T00:00:00.000Z')

function createSession(): Session {
  return Session.start({
    sessionId: 'session-1',
    accountId: 'account-1',
    themeId: 'theme-1',
    configuration: SessionConfiguration.create({
      difficulty: 'easy',
      categorySlug: 'self-awareness',
      searchWindowMinutes: 4,
    }),
    createdAt: new Date('2026-08-18T23:50:00.000Z'),
  })
}

function createHarness(session: Session | null) {
  const saved: Session[] = []
  const events = new FakeEventBus()
  let nextId = 0
  let transactionRuns = 0
  const sessions: SessionsRepository = {
    findById: () => Promise.resolve(session),
    findActiveByAccountId: () => Promise.resolve(null),
    listByAccount: () => Promise.resolve([]),
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    markDeleted: () => Promise.resolve(true),
    save: (value) => {
      saved.push(value)
      return Promise.resolve()
    },
  }
  const useCase = new ExpireSessionUseCase({
    sessions,
    eventPublisher: events,
    idGenerator: { generate: () => `event-${(nextId += 1)}` },
    unitOfWork: {
      run: (operation) => {
        transactionRuns += 1
        return operation()
      },
    },
    clock: { now: () => NOW },
  })

  return { events, saved, transactionRuns: () => transactionRuns, useCase }
}

describe('ExpireSessionUseCase', () => {
  it.each(['abandoned', 'timeout'] as const)(
    'expires an in-progress session for %s and publishes only SessionExpired',
    async (reason) => {
      const session = createSession()
      const harness = createHarness(session)

      await harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1', reason })

      expect(session.state).toBe('expired')
      expect(session.expiredReason).toBe(reason)
      expect(harness.saved).toEqual([session])
      expect(harness.transactionRuns()).toBe(1)
      expect(harness.events.published).toHaveLength(1)
      expect(harness.events.published[0]).toMatchObject({
        eventName: 'session_expired',
        payload: { sessionId: 'session-1', accountId: 'account-1', stoppedAtStage: 'in_progress' },
      })
    },
  )

  it('also publishes MicrophonePermissionDenied for a denied microphone permission', async () => {
    const harness = createHarness(createSession())

    await harness.useCase.execute({
      accountId: 'account-1',
      sessionId: 'session-1',
      reason: 'microphone_permission_denied',
    })
    expect(harness.events.published).toHaveLength(2)
    expect(harness.events.published.map((event) => event.eventName)).toEqual([
      'session_expired',
      'microphone_permission_denied',
    ])
  })

  it('is a no-op for a session that is no longer in progress', async () => {
    const session = createSession()
    session.expire('abandoned', NOW)
    const harness = createHarness(session)

    await expect(
      harness.useCase.execute({
        accountId: 'account-1',
        sessionId: 'session-1',
        reason: 'timeout',
      }),
    ).resolves.toBeUndefined()

    expect(harness.saved).toHaveLength(0)
    expect(harness.events.published).toHaveLength(0)
    expect(harness.transactionRuns()).toBe(1)
  })

  it('rejects an unknown session', async () => {
    const harness = createHarness(null)

    await expect(
      harness.useCase.execute({
        accountId: 'account-1',
        sessionId: 'missing-session',
        reason: 'timeout',
      }),
    ).rejects.toEqual(new SessionNotFoundError('missing-session'))
  })
})
