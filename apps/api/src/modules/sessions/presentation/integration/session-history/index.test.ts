import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import type { SessionState } from '@/modules/sessions/domain/entities/session/types.js'
import { LocalCalendar } from '@/modules/sessions/domain/services/local-calendar/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import {
  createSessionsIntegrationContainer,
  type SessionsIntegrationContainer,
} from '@/modules/sessions/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearSessionsData,
} from '@/modules/sessions/composition/integration-fixtures.js'

const ACCOUNT_A = '00000000-0000-4000-8000-000000000061'
const ACCOUNT_B = '00000000-0000-4000-8000-000000000062'
const THEME_ID = '00000000-0000-4000-8000-000000000063'

interface HistoryResponseBody {
  readonly data: readonly {
    readonly sessionId: string
    readonly localDate: string
    readonly localTime: string
    readonly state: SessionState
    readonly bestOfDay: boolean
  }[]
  readonly meta: { readonly nextCursor: string | null; readonly timeZone: string }
}

let harness: SessionsIntegrationContainer

function sessionId(suffix: number): string {
  return `00000000-0000-4000-8000-${suffix.toString(16).padStart(12, '0')}`
}

async function seedSession(input: {
  readonly sessionId: string
  readonly accountId: string
  readonly state: SessionState
  readonly createdAt: Date
  readonly totalScore?: number | null
}): Promise<void> {
  const session = Session.reconstitute({
    sessionId: input.sessionId,
    accountId: input.accountId,
    themeId: THEME_ID,
    configuration: SessionConfiguration.create({
      difficulty: 'balanced',
      categorySlug: 'history',
      searchWindowMinutes: 4,
    }),
    quotaReservationId: input.sessionId,
    state: input.state,
    createdAt: input.createdAt,
    expiresAt: new Date(input.createdAt.getTime() + 15 * 60 * 1000),
    expiredReason: null,
    expiredAt: null,
    recordedAt: null,
    totalScore: input.totalScore ?? null,
    completedAt: input.state === 'completed' ? input.createdAt : null,
    failedAt: input.state === 'failed' ? input.createdAt : null,
    deletedAt: input.state === 'deleted' ? input.createdAt : null,
  })

  await harness.container.repositories.sessions.save(session)
}

async function getHistory(
  accessToken: string,
  cursor?: string,
): Promise<{
  readonly statusCode: number
  readonly response: Awaited<ReturnType<typeof harness.app.inject>>
  readonly body: HistoryResponseBody
}> {
  const response = await harness.app.inject({
    method: 'GET',
    url: cursor === undefined ? '/sessions' : `/sessions?cursor=${cursor}`,
    headers: { authorization: `Bearer ${accessToken}` },
  })

  return {
    statusCode: response.statusCode,
    response,
    body: response.json<HistoryResponseBody>(),
  }
}

beforeAll(async () => {
  harness = await createSessionsIntegrationContainer({ databaseUrl: inject('databaseUrl') })
})

afterAll(async () => {
  await harness.close()
})

beforeEach(async () => {
  await clearSessionsData(harness.prisma)
  harness.reset()
  harness.accounts.registerIdentity('account-a', ACCOUNT_A)
  harness.accounts.registerIdentity('account-b', ACCOUNT_B)
})

describe('session history integration', () => {
  it('returns the account history ordered by most recent, matching the account time zone', async () => {
    const timeZone = 'America/Sao_Paulo'
    harness.accounts.registerProfile(ACCOUNT_A, { plan: 'free', timeZone })

    const now = new Date('2026-08-19T15:30:00.000Z')
    const oldest = {
      sessionId: sessionId(1),
      state: 'completed' as const,
      createdAt: new Date(now.getTime() - 2 * 60_000),
      totalScore: 80,
    }
    const newest = {
      sessionId: sessionId(2),
      state: 'in_progress' as const,
      createdAt: now,
      totalScore: null,
    }
    const middle = {
      sessionId: sessionId(3),
      state: 'expired' as const,
      createdAt: new Date(now.getTime() - 60_000),
      totalScore: null,
    }

    for (const seed of [oldest, newest, middle]) {
      await seedSession({ accountId: ACCOUNT_A, ...seed })
    }

    const response = await harness.app.inject({
      method: 'GET',
      url: '/sessions',
      headers: { authorization: 'Bearer account-a' },
    })

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'GET', '/sessions', response, 200)
    const body = response.json<HistoryResponseBody>()

    expect(body.data.map((item) => item.sessionId)).toEqual([
      newest.sessionId,
      middle.sessionId,
      oldest.sessionId,
    ])
    for (const seed of [oldest, newest, middle]) {
      const item = body.data.find((candidate) => candidate.sessionId === seed.sessionId)
      expect(item).toMatchObject({
        state: seed.state,
        localDate: LocalCalendar.localDayOf(seed.createdAt, timeZone),
        localTime: LocalCalendar.localTimeOf(seed.createdAt, timeZone),
      })
    }
    expect(body.meta.timeZone).toBe(timeZone)
  })

  it('paginates in descending order without repeats or gaps, hiding deleted sessions from every page', async () => {
    harness.accounts.registerProfile(ACCOUNT_A, { plan: 'free', timeZone: 'UTC' })

    const base = new Date('2026-08-01T00:00:00.000Z')
    const visibleIds: string[] = []
    for (let index = 0; index < 21; index += 1) {
      const id = sessionId(index)
      visibleIds.push(id)
      await seedSession({
        sessionId: id,
        accountId: ACCOUNT_A,
        state: 'completed',
        createdAt: new Date(base.getTime() - index * 60_000),
        totalScore: 50,
      })
    }
    const deletedId = sessionId(999)
    await seedSession({
      sessionId: deletedId,
      accountId: ACCOUNT_A,
      state: 'deleted',
      createdAt: new Date(base.getTime() - 10 * 60_000 - 30_000),
    })

    const firstPage = await getHistory('account-a')
    expect(firstPage.statusCode).toBe(200)
    expect(firstPage.body.data).toHaveLength(20)
    expect(firstPage.body.data.map((item) => item.sessionId)).toEqual(visibleIds.slice(0, 20))
    expect(firstPage.body.meta.nextCursor).toBe(visibleIds[19])

    const secondPage = await getHistory('account-a', firstPage.body.meta.nextCursor ?? undefined)
    expect(secondPage.statusCode).toBe(200)
    expect(secondPage.body.data).toHaveLength(1)
    expect(secondPage.body.data[0]?.sessionId).toBe(visibleIds[20])
    expect(secondPage.body.meta.nextCursor).toBeNull()

    const allReturnedIds = [...firstPage.body.data, ...secondPage.body.data].map(
      (item) => item.sessionId,
    )
    expect(allReturnedIds).toEqual(visibleIds)
    expect(allReturnedIds).not.toContain(deletedId)

    await expect(harness.prisma.session.count({ where: { accountId: ACCOUNT_A } })).resolves.toBe(
      22,
    )
    await expect(
      harness.prisma.session.findUnique({ where: { id: deletedId } }),
    ).resolves.toMatchObject({ state: 'deleted' })
    expect(harness.eventBus.published).toEqual([])
    expect(harness.quota.releaseCalls).toEqual([])
  })

  it('marks only the highest scoring completed session of the day as best of day, and reclassifies it when the time zone shifts the day boundary', async () => {
    harness.accounts.registerProfile(ACCOUNT_A, { plan: 'free', timeZone: 'UTC' })

    const lowerScore = {
      sessionId: sessionId(1),
      createdAt: new Date('2026-08-19T02:00:00.000Z'),
      totalScore: 70,
    }
    const higherScore = {
      sessionId: sessionId(2),
      createdAt: new Date('2026-08-19T20:00:00.000Z'),
      totalScore: 90,
    }
    const failedWithHigherScore = {
      sessionId: sessionId(3),
      createdAt: new Date('2026-08-19T15:00:00.000Z'),
      totalScore: 99,
    }
    const expiredWithHigherScore = {
      sessionId: sessionId(4),
      createdAt: new Date('2026-08-19T16:00:00.000Z'),
      totalScore: 98,
    }

    await seedSession({ ...lowerScore, accountId: ACCOUNT_A, state: 'completed' })
    await seedSession({ ...higherScore, accountId: ACCOUNT_A, state: 'completed' })
    await seedSession({ ...failedWithHigherScore, accountId: ACCOUNT_A, state: 'failed' })
    await seedSession({ ...expiredWithHigherScore, accountId: ACCOUNT_A, state: 'expired' })

    const sameDay = await getHistory('account-a')
    expect(sameDay.statusCode).toBe(200)
    const sameDayMarks = new Map(sameDay.body.data.map((item) => [item.sessionId, item.bestOfDay]))
    expect(sameDayMarks.get(higherScore.sessionId)).toBe(true)
    expect(sameDayMarks.get(lowerScore.sessionId)).toBe(false)
    expect(sameDayMarks.get(failedWithHigherScore.sessionId)).toBe(false)
    expect(sameDayMarks.get(expiredWithHigherScore.sessionId)).toBe(false)

    harness.accounts.registerProfile(ACCOUNT_A, { plan: 'free', timeZone: 'America/Sao_Paulo' })

    const shifted = await getHistory('account-a')
    expect(shifted.statusCode).toBe(200)
    const shiftedMarks = new Map(shifted.body.data.map((item) => [item.sessionId, item.bestOfDay]))
    expect(shiftedMarks.get(lowerScore.sessionId)).toBe(true)
    expect(shiftedMarks.get(higherScore.sessionId)).toBe(true)

    await expect(
      harness.prisma.session.findMany({ where: { accountId: ACCOUNT_A } }),
    ).resolves.toHaveLength(4)
    expect(harness.eventBus.published).toEqual([])
    expect(harness.quota.releaseCalls).toEqual([])
  })

  it('never exposes account A history to account B and rejects a cross-account cursor', async () => {
    harness.accounts.registerProfile(ACCOUNT_A, { plan: 'free', timeZone: 'UTC' })
    harness.accounts.registerProfile(ACCOUNT_B, { plan: 'free', timeZone: 'UTC' })

    const accountASessionId = sessionId(1)
    await seedSession({
      sessionId: accountASessionId,
      accountId: ACCOUNT_A,
      state: 'completed',
      createdAt: new Date('2026-08-19T12:00:00.000Z'),
      totalScore: 80,
    })

    const asB = await getHistory('account-b')
    expect(asB.statusCode).toBe(200)
    expect(asB.body.data).toEqual([])

    const withCrossAccountCursor = await getHistory('account-b', accountASessionId)
    expect(withCrossAccountCursor.statusCode).toBe(400)
    assertResponseMatchesSchema(
      harness.app,
      'GET',
      '/sessions',
      withCrossAccountCursor.response,
      400,
    )
    expect(withCrossAccountCursor.body).toMatchObject({
      error: { code: 'sessions.INVALID_HISTORY_CURSOR' },
    })
  })
})
