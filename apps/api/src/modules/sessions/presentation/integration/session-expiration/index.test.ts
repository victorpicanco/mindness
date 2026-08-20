import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  createSessionsIntegrationContainer,
  type SessionsIntegrationContainer,
} from '@/modules/sessions/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearSessionsData,
} from '@/modules/sessions/composition/integration-fixtures.js'

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000011'
const OTHER_ACCOUNT_ID = '00000000-0000-4000-8000-000000000012'
const THEME_ID = '00000000-0000-4000-8000-000000000013'

let harness: SessionsIntegrationContainer

async function start(token = 'account-token'): Promise<string> {
  const response = await harness.app.inject({
    method: 'POST',
    url: '/sessions',
    headers: { authorization: `Bearer ${token}` },
    payload: { difficulty: 'easy', categorySlug: 'focus', searchWindowMinutes: 3 },
  })
  expect(response.statusCode).toBe(201)
  assertResponseMatchesSchema(harness.app, 'POST', '/sessions', response, 201)
  return response.json<{ data: { readonly sessionId: string } }>().data.sessionId
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
  harness.accounts.registerIdentity('account-token', ACCOUNT_ID)
  harness.accounts.registerIdentity('other-token', OTHER_ACCOUNT_ID)
  harness.themes.registerEligibleTheme({
    categorySlug: 'focus',
    difficulty: 'easy',
    themeId: THEME_ID,
  })
})

describe('session expiration integration', () => {
  it('abandons a session and releases its reservation', async () => {
    const sessionId = await start()
    const response = await harness.app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/abandon`,
      headers: { authorization: 'Bearer account-token' },
    })
    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'POST', '/sessions/{sessionId}/abandon', response, 200)
    expect(response.json()).toEqual({ data: null })
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({ state: 'expired', expiredReason: 'abandoned' })
    expect(harness.quota.releaseCalls).toEqual([{ sessionId }])
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual([
      'session_started',
      'session_expired',
    ])
  })

  it('records microphone denial and emits both expiration events', async () => {
    const sessionId = await start()
    const response = await harness.app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/microphone-permission-denied`,
      headers: { authorization: 'Bearer account-token' },
    })
    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/microphone-permission-denied',
      response,
      200,
    )
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({ state: 'expired', expiredReason: 'microphone_permission_denied' })
    expect(harness.quota.releaseCalls).toEqual([{ sessionId }])
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual([
      'session_started',
      'session_expired',
      'microphone_permission_denied',
    ])
  })

  it('sweeps only expired in-progress sessions from every account', async () => {
    const expiredSessionId = await start()
    harness.clock.advance(15 * 60 * 1000)
    const activeSessionId = await start('other-token')
    const result = await harness.container.useCases.sweepExpiredSessions.execute()
    expect(result).toEqual({ expiredCount: 1 })
    await expect(
      harness.prisma.session.findUnique({ where: { id: expiredSessionId } }),
    ).resolves.toMatchObject({ state: 'expired' })
    await expect(
      harness.prisma.session.findUnique({ where: { id: activeSessionId } }),
    ).resolves.toMatchObject({ state: 'in_progress' })
    expect(harness.quota.releaseCalls).toEqual([{ sessionId: expiredSessionId }])
    expect(
      harness.eventBus.published.filter((event) => event.eventName === 'session_expired'),
    ).toHaveLength(1)
  })
})
