import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionAlreadyRunningError } from '@/modules/sessions/domain/errors/session-already-running-error/index.js'
import { ThemeUnavailableError } from '@/modules/sessions/domain/errors/theme-unavailable-error/index.js'
import type { EventPublisher } from '@/modules/sessions/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/sessions/domain/ports/id-generator/index.js'
import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { ThemesPort } from '@/modules/sessions/domain/ports/themes-port/index.js'
import type { UnitOfWork } from '@/modules/sessions/domain/ports/unit-of-work/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'
import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

import { StartSessionUseCase } from './index.js'

const NOW = new Date('2026-08-19T00:00:00.000Z')
const VALID_INPUT = {
  accountId: 'account-1',
  difficulty: 'easy',
  categorySlug: 'self-awareness',
  searchWindowMinutes: 4,
} as const

class QuotaExhaustedError extends ConflictError {
  readonly code = 'quota.QUOTA_EXHAUSTED'

  constructor() {
    super('Quota is exhausted', { context: { accountId: 'account-1' } })
  }
}

function createSession(sessionId: string, createdAt: Date = NOW): Session {
  return Session.start({
    sessionId,
    accountId: 'account-1',
    themeId: 'theme-1',
    configuration: SessionConfiguration.create({
      difficulty: 'easy',
      categorySlug: 'self-awareness',
      searchWindowMinutes: 4,
    }),
    quotaReservationId: 'reservation-1',
    createdAt,
  })
}

function createDependencies(input?: {
  readonly activeSession?: Session | null
  readonly eligibleTheme?: { readonly themeId: string } | null
  readonly quotaError?: Error
  readonly saveError?: Error
}) {
  const saved: Session[] = []
  const events = new FakeEventBus()
  const operations: string[] = []
  const quotaCalls: string[] = []
  const themeCalls: string[] = []
  const releasedSessionIds: string[] = []
  let transactionRuns = 0
  let nextId = 0
  const sessions: SessionsRepository = {
    findById: () => Promise.resolve(input?.activeSession ?? null),
    findActiveByAccountId: () => Promise.resolve(input?.activeSession ?? null),
    listByAccount: () => Promise.resolve([]),
    findCompletedBetween: () => Promise.resolve([]),
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    save: (session) => {
      operations.push('save')
      if (input?.saveError !== undefined) return Promise.reject(input.saveError)
      saved.push(session)
      return Promise.resolve()
    },
  }
  const themes: ThemesPort = {
    drawEligibleTheme: ({ categorySlug }) => {
      themeCalls.push(categorySlug)
      return Promise.resolve(input?.eligibleTheme ?? null)
    },
  }
  const quota: QuotaPort = {
    reserveForSession: ({ sessionId }) => {
      operations.push('reserve')
      quotaCalls.push(sessionId)
      if (input?.quotaError !== undefined) return Promise.reject(input.quotaError)
      return Promise.resolve({
        reservationId: `reservation-${sessionId}`,
        enforced: true,
        remaining: 3,
      })
    },
    releaseReservation: ({ sessionId }) => {
      operations.push('release')
      releasedSessionIds.push(sessionId)
      return Promise.resolve()
    },
  }
  const eventPublisher: EventPublisher = events
  const idGenerator: IdGenerator = { generate: () => `generated-${(nextId += 1)}` }
  const unitOfWork: UnitOfWork = {
    run: (operation) => {
      transactionRuns += 1
      return operation()
    },
  }

  return {
    events,
    operations,
    quotaCalls,
    themeCalls,
    releasedSessionIds,
    saved,
    transactionRuns: () => transactionRuns,
    dependencies: {
      sessions,
      themes,
      quota,
      clock: { now: () => NOW },
      eventPublisher,
      idGenerator,
      unitOfWork,
    },
  }
}

describe('StartSessionUseCase', () => {
  it('rejects a new session while the account has an unexpired session in progress', async () => {
    const harness = createDependencies({
      activeSession: createSession('session-1', new Date('2026-08-18T23:50:00.000Z')),
      eligibleTheme: { themeId: 'theme-2' },
    })
    const useCase = new StartSessionUseCase(harness.dependencies)

    await expect(useCase.execute(VALID_INPUT)).rejects.toEqual(
      new SessionAlreadyRunningError('session-1'),
    )

    expect(harness.themeCalls).toEqual([])
    expect(harness.quotaCalls).toEqual([])
    expect(harness.saved).toHaveLength(0)
  })

  it('expires a stale active session in its own transaction before starting a new one', async () => {
    const staleSession = createSession('stale-session', new Date('2026-08-18T23:45:00.000Z'))
    const harness = createDependencies({
      activeSession: staleSession,
      eligibleTheme: { themeId: 'theme-2' },
    })
    const useCase = new StartSessionUseCase(harness.dependencies)

    const result = await useCase.execute(VALID_INPUT)

    expect(staleSession.state).toBe('expired')
    expect(staleSession.expiredReason).toBe('timeout')
    expect(harness.releasedSessionIds).toEqual(['stale-session'])
    expect(harness.events.published[0]).toMatchObject({
      eventName: 'session_expired',
      payload: { sessionId: 'stale-session', stoppedAtStage: 'in_progress' },
    })
    expect(harness.saved).toHaveLength(2)
    expect(harness.transactionRuns()).toBe(2)
    expect(result.themeId).toBe('theme-2')
    expect(result.expiresAt).toBe('2026-08-19T00:15:00.000Z')
  })

  it('publishes an unavailable theme event without reserving quota or saving a session', async () => {
    const harness = createDependencies()
    const useCase = new StartSessionUseCase(harness.dependencies)

    await expect(useCase.execute(VALID_INPUT)).rejects.toEqual(
      new ThemeUnavailableError('self-awareness', 'easy'),
    )

    expect(harness.quotaCalls).toHaveLength(0)
    expect(harness.saved).toHaveLength(0)
    expect(harness.events.published).toContainEqual(
      expect.objectContaining({ eventName: 'theme_unavailable' }),
    )
  })

  it('propagates quota exhaustion without saving a session or publishing session started', async () => {
    const quotaError = new QuotaExhaustedError()
    const harness = createDependencies({
      eligibleTheme: { themeId: 'theme-2' },
      quotaError,
    })
    const useCase = new StartSessionUseCase(harness.dependencies)

    await expect(useCase.execute(VALID_INPUT)).rejects.toBe(quotaError)

    expect(harness.saved).toHaveLength(0)
    expect(harness.events.published).not.toContainEqual(
      expect.objectContaining({ eventName: 'session_started' }),
    )
  })

  it('starts a session with the granted quota and publishes its event', async () => {
    const harness = createDependencies({ eligibleTheme: { themeId: 'theme-2' } })
    const useCase = new StartSessionUseCase(harness.dependencies)

    const result = await useCase.execute(VALID_INPUT)

    expect(harness.saved).toHaveLength(1)
    expect(harness.saved[0]).toMatchObject({
      id: 'generated-1',
      themeId: 'theme-2',
      quotaReservationId: 'reservation-generated-1',
      state: 'in_progress',
    })
    expect(harness.saved[0]?.expiresAt).toEqual(new Date('2026-08-19T00:15:00.000Z'))
    expect(harness.events.published[0]).toMatchObject({
      eventName: 'session_started',
      payload: { sessionId: 'generated-1', remaining: 3, surface: 'web' },
    })
    expect(result).toEqual({
      sessionId: 'generated-1',
      themeId: 'theme-2',
      expiresAt: '2026-08-19T00:15:00.000Z',
      remaining: 3,
    })
  })

  it('releases the reservation and rethrows the original save error when saving fails', async () => {
    const saveError = new DatabaseError('Failed to save the session')
    const harness = createDependencies({
      eligibleTheme: { themeId: 'theme-2' },
      saveError,
    })
    const useCase = new StartSessionUseCase(harness.dependencies)

    await expect(useCase.execute(VALID_INPUT)).rejects.toBe(saveError)

    expect(harness.releasedSessionIds).toEqual(['generated-1'])
    expect(harness.operations).toEqual(['reserve', 'save', 'release'])
  })

  // D-12: the value object is defence in depth for callers that skip the HTTP schema; it must
  // reject before the saga takes a reservation it would then have to compensate.
  it.each([
    { field: 'difficulty', input: { ...VALID_INPUT, difficulty: 'impossible' } },
    { field: 'categorySlug', input: { ...VALID_INPUT, categorySlug: '  ' } },
    { field: 'searchWindowMinutes', input: { ...VALID_INPUT, searchWindowMinutes: 9 } },
  ])('rejects an invalid $field without touching themes or quota', async ({ input }) => {
    const harness = createDependencies({ eligibleTheme: { themeId: 'theme-2' } })
    const useCase = new StartSessionUseCase(harness.dependencies)

    await expect(useCase.execute(input)).rejects.toThrow(ValidationFailedError)

    expect(harness.themeCalls).toEqual([])
    expect(harness.quotaCalls).toEqual([])
    expect(harness.operations).toEqual([])
    expect(harness.saved).toHaveLength(0)
  })
})
