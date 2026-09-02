import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionAuthenticationRejectedError } from '@/modules/sessions/domain/errors/session-authentication-rejected-error/index.js'
import { SessionNotDeletableError } from '@/modules/sessions/domain/errors/session-not-deletable-error/index.js'
import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import type { AccountsPort } from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { EventPublisher } from '@/modules/sessions/domain/ports/event-publisher/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import { DeleteSessionUseCase } from './index.js'

const NOW = new Date('2026-08-22T12:00:00.000Z')

function createSession(
  state: 'completed' | 'processing' | 'deleted',
  accountId = 'account-1',
): Session {
  return Session.reconstitute({
    sessionId: 'session-1',
    accountId,
    themeId: 'theme-1',
    configuration: SessionConfiguration.create({
      difficulty: 'easy',
      categorySlug: 'self-awareness',
      searchWindowMinutes: 4,
    }),
    state,
    createdAt: new Date('2026-08-22T10:00:00.000Z'),
    expiresAt: new Date('2026-08-22T10:15:00.000Z'),
    expiredReason: null,
    expiredAt: null,
    recordedAt: null,
    completedAt: state === 'completed' ? new Date('2026-08-22T10:05:00.000Z') : null,
    deletedAt: state === 'deleted' ? new Date('2026-08-22T11:00:00.000Z') : null,
  })
}

function createHarness(session: Session | null, profileExists = true, wonTheRace = true) {
  const calls: string[] = []
  const deleted: Session[] = []
  const published: Parameters<EventPublisher['publish']>[0][] = []
  const sessions: SessionsRepository = {
    findById: () => Promise.resolve(session),
    findActiveByAccountId: () => Promise.resolve(null),
    listByAccount: () => Promise.resolve([]),
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    markDeleted: (value) => {
      calls.push('markDeleted')
      deleted.push(value)
      return Promise.resolve(wonTheRace)
    },
    save: () => Promise.resolve(),
  }
  const accounts: AccountsPort = {
    resolveAccountId: () => Promise.resolve(null),
    findProfile: () =>
      Promise.resolve(profileExists ? { plan: 'free', timeZone: 'America/Sao_Paulo' } : null),
    canStartPractice: () => Promise.resolve(true),
  }
  const eventPublisher: EventPublisher = {
    publish: (event) => {
      calls.push('publish')
      published.push(event)
      return Promise.resolve()
    },
  }
  const useCase = new DeleteSessionUseCase({
    sessions,
    accounts,
    clock: { now: () => NOW },
    idGenerator: { generate: () => 'event-1' },
    eventPublisher,
  })

  return { calls, published, deleted, useCase }
}

describe('DeleteSessionUseCase', () => {
  it('deletes an owned completed session, persists it, and publishes the deletion after persisting', async () => {
    const session = createSession('completed')
    const harness = createHarness(session)

    await harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' })

    expect(session.state).toBe('deleted')
    expect(session.deletedAt).toEqual(NOW)
    expect(harness.deleted).toEqual([session])
    expect(harness.calls).toEqual(['markDeleted', 'publish'])
    expect(harness.published).toHaveLength(1)
    expect(harness.published[0]).toMatchObject({
      eventName: 'session_deleted',
      eventId: 'event-1',
      payload: { sessionId: 'session-1', accountId: 'account-1', plan: 'free' },
    })
  })

  it.each([
    ['another account', createSession('completed', 'account-2')],
    ['a missing session', null],
    ['an already deleted session', createSession('deleted')],
  ])('rejects %s as not found', async (_caseName, session) => {
    const harness = createHarness(session)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new SessionNotFoundError('session-1'))
  })

  it('leaves the deletion state rule to the session entity', async () => {
    const harness = createHarness(createSession('processing'))

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new SessionNotDeletableError('processing'))
  })

  it('publishes nothing when a concurrent request deleted the session first', async () => {
    const harness = createHarness(createSession('completed'), true, false)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new SessionNotFoundError('session-1'))
    expect(harness.calls).toEqual(['markDeleted'])
    expect(harness.published).toEqual([])
  })

  it('rejects when the session account no longer has a profile', async () => {
    const harness = createHarness(createSession('completed'), false)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new SessionAuthenticationRejectedError())
  })
})
