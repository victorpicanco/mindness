import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { PracticeNotAllowedError } from '@/modules/sessions/domain/errors/practice-not-allowed-error/index.js'
import { SessionAlreadyRunningError } from '@/modules/sessions/domain/errors/session-already-running-error/index.js'
import { ThemeUnavailableError } from '@/modules/sessions/domain/errors/theme-unavailable-error/index.js'
import type { AccountsPort } from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { EventPublisher } from '@/modules/sessions/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/sessions/domain/ports/id-generator/index.js'
import type { ThemesPort } from '@/modules/sessions/domain/ports/themes-port/index.js'
import type { UnitOfWork } from '@/modules/sessions/domain/ports/unit-of-work/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
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
    createdAt,
  })
}

function createDependencies(input?: {
  readonly activeSession?: Session | null
  readonly eligibleTheme?: { readonly themeId: string; readonly title?: string } | null
  readonly saveError?: Error
  readonly practiceAllowed?: boolean
}) {
  const saved: Session[] = []
  const events = new FakeEventBus()
  const operations: string[] = []
  const themeCalls: string[] = []
  const accountsCalls: string[] = []
  let transactionRuns = 0
  let nextId = 0
  const accounts: Pick<AccountsPort, 'canStartPractice'> = {
    canStartPractice: (accountId) => {
      accountsCalls.push(accountId)
      return Promise.resolve(input?.practiceAllowed ?? true)
    },
  }
  const sessions: SessionsRepository = {
    findById: () => Promise.resolve(input?.activeSession ?? null),
    findActiveByAccountId: () => Promise.resolve(input?.activeSession ?? null),
    listByAccount: () => Promise.resolve([]),
    findCompletedBetween: () => Promise.resolve([]),
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    markDeleted: () => Promise.resolve(true),
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
      const eligibleTheme = input?.eligibleTheme
      return Promise.resolve(
        eligibleTheme === undefined || eligibleTheme === null
          ? null
          : { themeId: eligibleTheme.themeId, title: eligibleTheme.title ?? 'Theme' },
      )
    },
    findThemeById: (themeId) => Promise.resolve({ themeId, title: 'Theme' }),
    listCategories: () => Promise.resolve([]),
    listThemeTitles: () => Promise.resolve([]),
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
    themeCalls,
    accountsCalls,
    saved,
    transactionRuns: () => transactionRuns,
    dependencies: {
      sessions,
      themes,
      accounts,
      clock: { now: () => NOW },
      eventPublisher,
      idGenerator,
      unitOfWork,
    },
  }
}

describe('StartSessionUseCase', () => {
  it('rejects starting a session without a current consent, before drawing a theme', async () => {
    const harness = createDependencies({
      eligibleTheme: { themeId: 'theme-2' },
      practiceAllowed: false,
    })
    const useCase = new StartSessionUseCase(harness.dependencies)

    await expect(useCase.execute(VALID_INPUT)).rejects.toEqual(
      new PracticeNotAllowedError('account-1'),
    )

    expect(harness.accountsCalls).toEqual(['account-1'])
    expect(harness.themeCalls).toEqual([])
    expect(harness.saved).toHaveLength(0)
  })

  it('rejects a new session while the account has an unexpired session in progress', async () => {
    const harness = createDependencies({
      activeSession: createSession('session-1', new Date('2026-08-18T23:58:00.000Z')),
      eligibleTheme: { themeId: 'theme-2' },
    })
    const useCase = new StartSessionUseCase(harness.dependencies)

    await expect(useCase.execute(VALID_INPUT)).rejects.toEqual(
      new SessionAlreadyRunningError('session-1'),
    )

    expect(harness.themeCalls).toEqual([])
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
    expect(harness.events.published[0]).toMatchObject({
      eventName: 'session_expired',
      payload: { sessionId: 'stale-session', stoppedAtStage: 'in_progress' },
    })
    expect(harness.saved).toHaveLength(2)
    expect(harness.transactionRuns()).toBe(2)
    expect(result.themeId).toBe('theme-2')
    expect(result.expiresAt).toBe('2026-08-19T00:06:00.000Z')
  })

  it('publishes an unavailable theme event without saving a session', async () => {
    const harness = createDependencies()
    const useCase = new StartSessionUseCase(harness.dependencies)

    await expect(useCase.execute(VALID_INPUT)).rejects.toEqual(
      new ThemeUnavailableError('self-awareness', 'easy'),
    )
    expect(harness.saved).toHaveLength(0)
    expect(harness.events.published).toContainEqual(
      expect.objectContaining({ eventName: 'theme_unavailable' }),
    )
  })

  it('starts a session and publishes its event', async () => {
    const harness = createDependencies({ eligibleTheme: { themeId: 'theme-2' } })
    const useCase = new StartSessionUseCase(harness.dependencies)

    const result = await useCase.execute(VALID_INPUT)

    expect(harness.saved).toHaveLength(1)
    expect(harness.saved[0]).toMatchObject({
      id: 'generated-1',
      themeId: 'theme-2',
      state: 'in_progress',
    })
    expect(harness.saved[0]?.expiresAt).toEqual(new Date('2026-08-19T00:06:00.000Z'))
    expect(harness.saved[0]?.researchEndsAt).toEqual(new Date('2026-08-19T00:04:00.000Z'))
    expect(harness.events.published[0]).toMatchObject({
      eventName: 'session_started',
      payload: { sessionId: 'generated-1', surface: 'web' },
    })
    expect(result).toEqual({
      createdAt: '2026-08-19T00:00:00.000Z',
      serverNow: '2026-08-19T00:00:00.000Z',
      sessionId: 'generated-1',
      themeId: 'theme-2',
      themeTitle: 'Theme',
      expiresAt: '2026-08-19T00:06:00.000Z',
      researchEndsAt: '2026-08-19T00:04:00.000Z',
    })
  })

  it('rethrows the original save error when saving fails', async () => {
    const saveError = new DatabaseError('Failed to save the session')
    const harness = createDependencies({
      eligibleTheme: { themeId: 'theme-2' },
      saveError,
    })
    const useCase = new StartSessionUseCase(harness.dependencies)

    await expect(useCase.execute(VALID_INPUT)).rejects.toBe(saveError)

    expect(harness.operations).toEqual(['save'])
  })

  it.each([
    { field: 'difficulty', input: { ...VALID_INPUT, difficulty: 'impossible' } },
    { field: 'categorySlug', input: { ...VALID_INPUT, categorySlug: '  ' } },
    { field: 'searchWindowMinutes', input: { ...VALID_INPUT, searchWindowMinutes: 9 } },
  ])('rejects an invalid $field without touching themes', async ({ input }) => {
    const harness = createDependencies({ eligibleTheme: { themeId: 'theme-2' } })
    const useCase = new StartSessionUseCase(harness.dependencies)

    await expect(useCase.execute(input)).rejects.toThrow(ValidationFailedError)

    expect(harness.themeCalls).toEqual([])
    expect(harness.operations).toEqual([])
    expect(harness.saved).toHaveLength(0)
  })
})
