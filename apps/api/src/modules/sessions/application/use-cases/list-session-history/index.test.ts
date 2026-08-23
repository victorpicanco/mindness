import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionAuthenticationRejectedError } from '@/modules/sessions/domain/errors/session-authentication-rejected-error/index.js'
import type { AccountsPort } from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import { InvalidHistoryCursorError } from './errors.js'
import { ListSessionHistoryUseCase } from './index.js'

function createSession(params: {
  readonly id: string
  readonly state: 'completed' | 'processing' | 'failed' | 'expired' | 'deleted'
  readonly createdAt: Date
  readonly totalScore?: number
  readonly accountId?: string
}): Session {
  return Session.reconstitute({
    sessionId: params.id,
    accountId: params.accountId ?? 'account-1',
    themeId: 'theme-1',
    configuration: SessionConfiguration.create({
      difficulty: 'balanced',
      categorySlug: 'communication',
      searchWindowMinutes: 5,
    }),
    quotaReservationId: 'reservation-1',
    state: params.state,
    createdAt: params.createdAt,
    expiresAt: new Date(params.createdAt.getTime() + 15 * 60 * 1000),
    expiredReason: params.state === 'expired' ? 'timeout' : null,
    expiredAt: params.state === 'expired' ? params.createdAt : null,
    recordedAt: null,
    totalScore: params.totalScore ?? null,
    completedAt: params.state === 'completed' ? params.createdAt : null,
    failedAt: params.state === 'failed' ? params.createdAt : null,
    deletedAt: params.state === 'deleted' ? params.createdAt : null,
  })
}

function createHarness(params: {
  readonly page: readonly Session[]
  readonly candidates?: readonly Session[]
  readonly profile?: { readonly plan: 'free'; readonly timeZone: string } | null
  readonly cursorSession?: Session | null
}) {
  let completedBetweenCalls = 0
  const sessions: SessionsRepository = {
    findById: (sessionId) =>
      Promise.resolve(sessionId === 'cursor' ? (params.cursorSession ?? null) : null),
    findActiveByAccountId: () => Promise.resolve(null),
    listByAccount: () => Promise.resolve([...params.page]),
    findCompletedBetween: () => {
      completedBetweenCalls += 1
      return Promise.resolve([...(params.candidates ?? [])])
    },
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    markDeleted: () => Promise.resolve(true),
    save: () => Promise.resolve(),
  }
  const accounts: AccountsPort = {
    resolveAccountId: () => Promise.resolve(null),
    findProfile: () =>
      Promise.resolve(
        params.profile === undefined
          ? { plan: 'free', timeZone: 'America/Sao_Paulo' }
          : params.profile,
      ),
  }
  return {
    completedBetweenCalls: () => completedBetweenCalls,
    useCase: new ListSessionHistoryUseCase({ sessions, accounts }),
  }
}

describe('ListSessionHistoryUseCase', () => {
  it('never emits a deleted session, whatever the repository returns', async () => {
    const visible = createSession({
      id: 'visible',
      state: 'completed',
      createdAt: new Date('2026-08-22T12:00:00.000Z'),
      totalScore: 80,
    })
    const deleted = createSession({
      id: 'deleted',
      state: 'deleted',
      createdAt: new Date('2026-08-22T11:00:00.000Z'),
    })
    const harness = createHarness({ page: [visible, deleted] })

    const output = await harness.useCase.execute({ accountId: 'account-1', cursor: null })

    expect(output.items.map((item) => item.sessionId)).toEqual(['visible'])
  })

  it('returns serialized history items and marks only the best completed session of a local day', async () => {
    const lower = createSession({
      id: 'session-1',
      state: 'completed',
      totalScore: 70,
      createdAt: new Date('2026-08-22T12:00:00.000Z'),
    })
    const higher = createSession({
      id: 'session-2',
      state: 'completed',
      totalScore: 90,
      createdAt: new Date('2026-08-22T13:00:00.000Z'),
    })
    const processing = createSession({
      id: 'session-3',
      state: 'processing',
      createdAt: new Date('2026-08-22T14:00:00.000Z'),
    })
    const harness = createHarness({
      page: [processing, higher, lower],
      candidates: [lower, higher],
    })

    await expect(
      harness.useCase.execute({ accountId: 'account-1', cursor: null }),
    ).resolves.toEqual({
      items: [
        {
          sessionId: 'session-3',
          startedAt: '2026-08-22T14:00:00.000Z',
          localDate: '2026-08-22',
          localTime: '11:00',
          categorySlug: 'communication',
          difficulty: 'balanced',
          totalScore: null,
          state: 'processing',
          bestOfDay: false,
        },
        {
          sessionId: 'session-2',
          startedAt: '2026-08-22T13:00:00.000Z',
          localDate: '2026-08-22',
          localTime: '10:00',
          categorySlug: 'communication',
          difficulty: 'balanced',
          totalScore: 90,
          state: 'completed',
          bestOfDay: true,
        },
        {
          sessionId: 'session-1',
          startedAt: '2026-08-22T12:00:00.000Z',
          localDate: '2026-08-22',
          localTime: '09:00',
          categorySlug: 'communication',
          difficulty: 'balanced',
          totalScore: 70,
          state: 'completed',
          bestOfDay: false,
        },
      ],
      nextCursor: null,
      pageSize: 20,
      timeZone: 'America/Sao_Paulo',
    })
  })

  it('limits each page to twenty sessions and returns the twentieth id as the next cursor', async () => {
    const page = Array.from({ length: 21 }, (_, index) =>
      createSession({
        id: `session-${index + 1}`,
        state: 'completed',
        totalScore: index,
        createdAt: new Date(1760000000000 - index * 1000),
      }),
    )
    const harness = createHarness({ page, candidates: page })

    const result = await harness.useCase.execute({ accountId: 'account-1', cursor: null })

    expect(result.items).toHaveLength(20)
    expect(result.nextCursor).toBe('session-20')
    expect(result.pageSize).toBe(20)
  })

  it('returns an empty page without querying the best-of-day window', async () => {
    const harness = createHarness({ page: [] })

    await expect(
      harness.useCase.execute({ accountId: 'account-1', cursor: null }),
    ).resolves.toEqual({
      items: [],
      nextCursor: null,
      pageSize: 20,
      timeZone: 'America/Sao_Paulo',
    })
    expect(harness.completedBetweenCalls()).toBe(0)
  })

  it.each([
    ['a missing cursor', null],
    [
      'a cursor owned by another account',
      createSession({
        id: 'cursor',
        state: 'completed',
        createdAt: new Date(),
        accountId: 'account-2',
      }),
    ],
  ])('rejects %s', async (_caseName, cursorSession) => {
    const harness = createHarness({ page: [], cursorSession })

    await expect(
      harness.useCase.execute({ accountId: 'account-1', cursor: 'cursor' }),
    ).rejects.toEqual(new InvalidHistoryCursorError())
  })

  it('rejects an account without a profile', async () => {
    const harness = createHarness({ page: [], profile: null })

    await expect(harness.useCase.execute({ accountId: 'account-1', cursor: null })).rejects.toEqual(
      new SessionAuthenticationRejectedError(),
    )
  })

  it('recalculates best of day using the profile time zone', async () => {
    const first = createSession({
      id: 'session-1',
      state: 'completed',
      totalScore: 70,
      createdAt: new Date('2026-08-22T02:00:00.000Z'),
    })
    const second = createSession({
      id: 'session-2',
      state: 'completed',
      totalScore: 90,
      createdAt: new Date('2026-08-22T03:00:00.000Z'),
    })
    const saoPaulo = createHarness({ page: [second, first], candidates: [first, second] })
    const tokyo = createHarness({
      page: [second, first],
      candidates: [first, second],
      profile: { plan: 'free', timeZone: 'Asia/Tokyo' },
    })

    const saoPauloResult = await saoPaulo.useCase.execute({ accountId: 'account-1', cursor: null })
    const tokyoResult = await tokyo.useCase.execute({ accountId: 'account-1', cursor: null })

    expect(saoPauloResult.items.map((item) => item.bestOfDay)).toEqual([true, true])
    expect(tokyoResult.items.map((item) => item.bestOfDay)).toEqual([true, false])
    expect(saoPauloResult.timeZone).toBe('America/Sao_Paulo')
    expect(tokyoResult.timeZone).toBe('Asia/Tokyo')
  })
})
