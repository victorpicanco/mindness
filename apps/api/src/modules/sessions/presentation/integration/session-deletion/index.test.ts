import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import type { SessionState } from '@/modules/sessions/domain/entities/session/types.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import {
  createSessionsIntegrationContainer,
  SESSIONS_TEST_NOW,
  type SessionsIntegrationContainer,
} from '@/modules/sessions/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearSessionsData,
} from '@/modules/sessions/composition/integration-fixtures.js'

const ACCOUNT_A = '00000000-0000-4000-8000-000000000081'
const ACCOUNT_B = '00000000-0000-4000-8000-000000000082'
const THEME_ID = '00000000-0000-4000-8000-000000000083'

let harness: SessionsIntegrationContainer

async function seedSession(input: {
  readonly sessionId: string
  readonly accountId: string
  readonly state: SessionState
}): Promise<void> {
  const session = Session.reconstitute({
    sessionId: input.sessionId,
    accountId: input.accountId,
    themeId: THEME_ID,
    configuration: SessionConfiguration.create({
      difficulty: 'balanced',
      categorySlug: 'session-deletion',
      searchWindowMinutes: 4,
    }),
    state: input.state,
    createdAt: SESSIONS_TEST_NOW,
    expiresAt: new Date(SESSIONS_TEST_NOW.getTime() + 15 * 60 * 1000),
    expiredReason: null,
    expiredAt: null,
    recordedAt: null,
    completedAt: input.state === 'completed' ? SESSIONS_TEST_NOW : null,
  })

  await harness.container.repositories.sessions.save(session)
}

function deleteSession(
  sessionId: string,
  accessToken: string,
): Promise<Awaited<ReturnType<typeof harness.app.inject>>> {
  return harness.app.inject({
    method: 'DELETE',
    url: `/sessions/${sessionId}`,
    headers: { authorization: `Bearer ${accessToken}` },
  })
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
  harness.accounts.registerProfile(ACCOUNT_A, { plan: 'free', timeZone: 'UTC' })
})

describe('session deletion integration', () => {
  it('deletes a completed session, removes it immediately from view and publishes one event', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000091'
    await seedSession({ sessionId, accountId: ACCOUNT_A, state: 'completed' })

    const response = await deleteSession(sessionId, 'account-a')

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'DELETE', '/sessions/{sessionId}', response, 200)

    const persisted = await harness.prisma.session.findUnique({ where: { id: sessionId } })
    expect(persisted).toMatchObject({ state: 'deleted' })
    expect(persisted?.deletedAt).not.toBeNull()

    const history = await harness.app.inject({
      method: 'GET',
      url: '/sessions',
      headers: { authorization: 'Bearer account-a' },
    })
    expect(history.json<{ data: readonly unknown[] }>().data).toEqual([])

    const playback = await harness.app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/audio/playback-url`,
      headers: { authorization: 'Bearer account-a' },
    })
    expect(playback.statusCode).toBe(404)

    await expect(
      harness.container.useCases.checkReadability.execute({ sessionId, accountId: ACCOUNT_A }),
    ).resolves.toEqual({ failureReason: null, readable: false })

    expect(harness.eventBus.published).toHaveLength(1)
    expect(harness.eventBus.published[0]).toMatchObject({
      eventName: 'session_deleted',
      payload: { sessionId, accountId: ACCOUNT_A, plan: 'free' },
    })

    const secondDelete = await deleteSession(sessionId, 'account-a')
    expect(secondDelete.statusCode).toBe(404)
    expect(harness.eventBus.published).toHaveLength(1)
  })

  it('publishes a single event when two concurrent requests delete the same session', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000094'
    await seedSession({ sessionId, accountId: ACCOUNT_A, state: 'completed' })

    const [first, second] = await Promise.all([
      deleteSession(sessionId, 'account-a'),
      deleteSession(sessionId, 'account-a'),
    ])

    expect([first.statusCode, second.statusCode].toSorted((a, b) => a - b)).toEqual([200, 404])
    expect(harness.eventBus.published).toHaveLength(1)
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({ state: 'deleted' })
  })

  it('rejects deleting a session that is not in a terminal state', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000092'
    await seedSession({ sessionId, accountId: ACCOUNT_A, state: 'processing' })

    const response = await deleteSession(sessionId, 'account-a')

    expect(response.statusCode).toBe(409)
    assertResponseMatchesSchema(harness.app, 'DELETE', '/sessions/{sessionId}', response, 409)
    expect(response.json()).toMatchObject({
      error: { code: 'sessions.SESSION_NOT_DELETABLE' },
    })
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({ state: 'processing' })
  })

  it('never lets account B delete account A session, which stays intact', async () => {
    harness.accounts.registerProfile(ACCOUNT_B, { plan: 'free', timeZone: 'UTC' })
    const sessionId = '00000000-0000-4000-8000-000000000093'
    await seedSession({ sessionId, accountId: ACCOUNT_A, state: 'completed' })

    const response = await deleteSession(sessionId, 'account-b')

    expect(response.statusCode).toBe(404)
    assertResponseMatchesSchema(harness.app, 'DELETE', '/sessions/{sessionId}', response, 404)
    expect(response.json()).toMatchObject({ error: { code: 'sessions.SESSION_NOT_FOUND' } })
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({ state: 'completed', deletedAt: null })
    expect(harness.eventBus.published).toEqual([])
  })
})
