import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  createSessionsIntegrationContainer,
  SESSIONS_TEST_NOW,
  type SessionsIntegrationContainer,
} from '@/modules/sessions/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearSessionsData,
} from '@/modules/sessions/composition/integration-fixtures.js'

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000041'
const OTHER_ACCOUNT_ID = '00000000-0000-4000-8000-000000000042'
const THEME_ID = '00000000-0000-4000-8000-000000000043'
const SEARCH_WINDOW_MINUTES = 4
const MINUTE = 60 * 1000
const RESEARCH_ENDS_AT = new Date(SESSIONS_TEST_NOW.getTime() + SEARCH_WINDOW_MINUTES * MINUTE)
const GRACE_DEADLINE = new Date(RESEARCH_ENDS_AT.getTime() + 2 * MINUTE)
const SESSION_DEADLINE = new Date(SESSIONS_TEST_NOW.getTime() + 15 * MINUTE)

let harness: SessionsIntegrationContainer

async function start(): Promise<string> {
  const response = await harness.app.inject({
    method: 'POST',
    url: '/sessions',
    headers: { authorization: 'Bearer account-token' },
    payload: {
      difficulty: 'balanced',
      categorySlug: 'recording',
      searchWindowMinutes: SEARCH_WINDOW_MINUTES,
    },
  })

  expect(response.statusCode).toBe(201)
  expect(response.json<{ data: { readonly researchEndsAt: string } }>().data.researchEndsAt).toBe(
    RESEARCH_ENDS_AT.toISOString(),
  )

  return response.json<{ data: { readonly sessionId: string } }>().data.sessionId
}

function startRecording(sessionId: string, token = 'account-token') {
  return harness.app.inject({
    method: 'POST',
    url: `/sessions/${sessionId}/recording`,
    headers: { authorization: `Bearer ${token}` },
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
  harness.accounts.registerIdentity('account-token', ACCOUNT_ID)
  harness.accounts.registerIdentity('other-token', OTHER_ACCOUNT_ID)
  harness.themes.registerEligibleTheme({
    categorySlug: 'recording',
    difficulty: 'balanced',
    themeId: THEME_ID,
  })
})

describe('recording window integration', () => {
  it('starts a session whose deadline is the two-minute grace after the research window', async () => {
    const sessionId = await start()

    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({
      state: 'in_progress',
      expiresAt: GRACE_DEADLINE,
      recordingStartedAt: null,
    })
  })

  it('refuses to open the recording while the research window is still running', async () => {
    const sessionId = await start()
    harness.clock.advance(SEARCH_WINDOW_MINUTES * MINUTE - 1)

    const response = await startRecording(sessionId)

    expect(response.statusCode).toBe(409)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/recording',
      response,
      409,
    )
    expect(response.json()).toMatchObject({
      error: { code: 'sessions.RECORDING_WINDOW_NOT_OPEN' },
    })
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({ state: 'in_progress', recordingStartedAt: null })
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual(['session_started'])
  })

  it('opens the recording inside the grace and extends the session deadline', async () => {
    const sessionId = await start()
    harness.clock.set(RESEARCH_ENDS_AT)

    const response = await startRecording(sessionId)

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/recording',
      response,
      200,
    )
    expect(response.json()).toMatchObject({
      data: {
        recordingStartedAt: RESEARCH_ENDS_AT.toISOString(),
        expiresAt: SESSION_DEADLINE.toISOString(),
      },
    })
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({
      state: 'in_progress',
      expiresAt: SESSION_DEADLINE,
      recordingStartedAt: RESEARCH_ENDS_AT,
    })
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual(['session_started'])
  })

  it('keeps the audio upload authorized after the grace once the recording is open', async () => {
    const sessionId = await start()
    harness.clock.set(RESEARCH_ENDS_AT)
    expect((await startRecording(sessionId)).statusCode).toBe(200)
    harness.clock.set(new Date(GRACE_DEADLINE.getTime() + MINUTE))

    const response = await harness.app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/audio/upload-url`,
      headers: { authorization: 'Bearer account-token' },
    })

    expect(response.statusCode).toBe(200)
  })

  it('expires the session when the grace runs out without a recording', async () => {
    const sessionId = await start()
    harness.clock.set(GRACE_DEADLINE)

    const response = await startRecording(sessionId)

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ error: { code: 'sessions.SESSION_NOT_IN_PROGRESS' } })
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({
      state: 'expired',
      expiredReason: 'timeout',
      recordingStartedAt: null,
    })
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual([
      'session_started',
      'session_expired',
    ])
  })

  it('hides the recording of another account behind a not found', async () => {
    const sessionId = await start()
    harness.clock.set(RESEARCH_ENDS_AT)

    const response = await startRecording(sessionId, 'other-token')

    expect(response.statusCode).toBe(404)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/recording',
      response,
      404,
    )
    expect(response.json()).toMatchObject({ error: { code: 'sessions.SESSION_NOT_FOUND' } })
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({ state: 'in_progress', recordingStartedAt: null })
  })
})
