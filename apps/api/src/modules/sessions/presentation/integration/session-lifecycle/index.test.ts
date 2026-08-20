import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  createSessionsIntegrationContainer,
  type SessionsIntegrationContainer,
} from '@/modules/sessions/composition/integration-container.js'
import { clearSessionsData } from '@/modules/sessions/composition/integration-fixtures.js'

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000001'
const THEME_ID = '00000000-0000-4000-8000-000000000002'

let harness: SessionsIntegrationContainer

beforeAll(async () => {
  harness = await createSessionsIntegrationContainer({ databaseUrl: inject('databaseUrl') })
})

afterAll(async () => {
  await harness.close()
})

beforeEach(async () => {
  await clearSessionsData(harness.prisma)
  harness.reset()
  harness.accounts.registerIdentity('access-token', ACCOUNT_ID)
  harness.themes.registerEligibleTheme({
    categorySlug: 'focus',
    difficulty: 'balanced',
    themeId: THEME_ID,
  })
})

describe('session lifecycle integration', () => {
  it('starts a session through HTTP, persists it, and publishes its event', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { authorization: 'Bearer access-token' },
      payload: { difficulty: 'balanced', categorySlug: 'focus', searchWindowMinutes: 4 },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json<{
      data: {
        readonly sessionId: string
        readonly themeId: string
        readonly remaining: number | null
      }
    }>()
    expect(body.data).toMatchObject({ themeId: THEME_ID, remaining: 3 })

    await expect(
      harness.prisma.session.findUnique({ where: { id: body.data.sessionId } }),
    ).resolves.toMatchObject({
      accountId: ACCOUNT_ID,
      state: 'in_progress',
      themeId: THEME_ID,
    })
    const sessionStarted = harness.eventBus.published.find(
      (event) => event.eventName === 'session_started',
    )
    expect(sessionStarted).toBeDefined()
    if (sessionStarted === undefined) return

    expect(sessionStarted.payload).toMatchObject({
      sessionId: body.data.sessionId,
      accountId: ACCOUNT_ID,
    })
  })

  it('rejects a second active session without a second reservation or event', async () => {
    const first = await harness.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { authorization: 'Bearer access-token' },
      payload: { difficulty: 'balanced', categorySlug: 'focus', searchWindowMinutes: 4 },
    })
    expect(first.statusCode).toBe(201)

    const response = await harness.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { authorization: 'Bearer access-token' },
      payload: { difficulty: 'balanced', categorySlug: 'focus', searchWindowMinutes: 4 },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ error: { code: 'sessions.SESSION_ALREADY_RUNNING' } })
    await expect(harness.prisma.session.count()).resolves.toBe(1)
    expect(harness.quota.reserveCalls).toHaveLength(1)
    expect(harness.eventBus.published).toHaveLength(1)
  })

  it('expires a stale session before starting its replacement', async () => {
    const first = await harness.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { authorization: 'Bearer access-token' },
      payload: { difficulty: 'balanced', categorySlug: 'focus', searchWindowMinutes: 4 },
    })
    const firstId = first.json<{ data: { readonly sessionId: string } }>().data.sessionId
    harness.clock.advance(15 * 60 * 1000)

    const response = await harness.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { authorization: 'Bearer access-token' },
      payload: { difficulty: 'balanced', categorySlug: 'focus', searchWindowMinutes: 4 },
    })

    expect(response.statusCode).toBe(201)
    await expect(
      harness.prisma.session.findUnique({ where: { id: firstId } }),
    ).resolves.toMatchObject({
      state: 'expired',
      expiredReason: 'timeout',
    })
    expect(harness.quota.releaseCalls).toEqual([{ sessionId: firstId }])
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual([
      'session_started',
      'session_expired',
      'session_started',
    ])
  })

  it('reports an unavailable theme without persisting a session or reserving quota', async () => {
    harness.themes.reset()

    const response = await harness.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { authorization: 'Bearer access-token' },
      payload: { difficulty: 'balanced', categorySlug: 'focus', searchWindowMinutes: 4 },
    })

    expect(response.statusCode).toBe(422)
    expect(response.json()).toMatchObject({ error: { code: 'sessions.THEME_UNAVAILABLE' } })
    await expect(harness.prisma.session.count()).resolves.toBe(0)
    expect(harness.quota.reserveCalls).toHaveLength(0)
    expect(harness.eventBus.published).toMatchObject([{ eventName: 'theme_unavailable' }])
  })

  it('propagates quota exhaustion without persisting a session', async () => {
    harness.quota.configure({ enforced: true, remaining: 0 })

    const response = await harness.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { authorization: 'Bearer access-token' },
      payload: { difficulty: 'balanced', categorySlug: 'focus', searchWindowMinutes: 4 },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ error: { code: 'quota.QUOTA_EXHAUSTED' } })
    await expect(harness.prisma.session.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toHaveLength(0)
  })
})
