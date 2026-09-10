import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  createSessionsIntegrationContainer,
  type SessionsIntegrationContainer,
} from '@/modules/sessions/composition/integration-container.js'
import {
  applySessionAccessModeMigrationToLegacyRows,
  assertResponseMatchesSchema,
  clearSessionsData,
  readAudioFixture,
  setPersistedSessionState,
} from '@/modules/sessions/composition/integration-fixtures.js'

const GUEST_A = '00000000-0000-4000-8000-000000000041'
const GUEST_B = '00000000-0000-4000-8000-000000000042'
const REGISTERED = '00000000-0000-4000-8000-000000000043'
const THEME_ID = '00000000-0000-4000-8000-000000000044'

const CONFIGURATION = { difficulty: 'balanced', categorySlug: 'trial', searchWindowMinutes: 4 }

let harness: SessionsIntegrationContainer

function startSession(token: string) {
  return harness.app.inject({
    method: 'POST',
    url: '/sessions',
    headers: { authorization: `Bearer ${token}` },
    payload: CONFIGURATION,
  })
}

async function startGuestTrial(token = 'guest-a'): Promise<string> {
  const response = await startSession(token)
  expect(response.statusCode).toBe(201)
  assertResponseMatchesSchema(harness.app, 'POST', '/sessions', response, 201)

  return response.json<{ data: { readonly sessionId: string } }>().data.sessionId
}

function audioPath(accountId: string, sessionId: string): string {
  return `${accountId}/${sessionId}/audio`
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
  harness.accounts.registerIdentity('guest-a', GUEST_A)
  harness.accounts.registerIdentity('guest-b', GUEST_B)
  harness.accounts.registerIdentity('registered', REGISTERED)
  harness.accounts.registerGuest(GUEST_A)
  harness.accounts.registerGuest(GUEST_B)
  harness.themes.registerEligibleTheme({
    categorySlug: 'trial',
    difficulty: 'balanced',
    themeId: THEME_ID,
  })
})

describe('guest trial integration', () => {
  it('backfills pre-existing sessions as account sessions', async () => {
    await expect(applySessionAccessModeMigrationToLegacyRows(harness.prisma)).resolves.toEqual([
      { accountId: '00000000-0000-4000-8000-000000000081', accessMode: 'account' },
      { accountId: '00000000-0000-4000-8000-000000000082', accessMode: 'account' },
    ])
  })

  it('persists the first guest session as a guest trial derived from the account', async () => {
    const response = await startSession('guest-a')

    expect(response.statusCode).toBe(201)
    assertResponseMatchesSchema(harness.app, 'POST', '/sessions', response, 201)
    const { sessionId } = response.json<{ data: { readonly sessionId: string } }>().data

    await expect(
      harness.container.repositories.sessions.findById(sessionId),
    ).resolves.toMatchObject({ accountId: GUEST_A, accessMode: 'guest_trial' })
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual(['session_started'])
  })

  it('persists a registered session as an account session', async () => {
    const response = await startSession('registered')

    expect(response.statusCode).toBe(201)
    assertResponseMatchesSchema(harness.app, 'POST', '/sessions', response, 201)
    const { sessionId } = response.json<{ data: { readonly sessionId: string } }>().data

    await expect(
      harness.container.repositories.sessions.findById(sessionId),
    ).resolves.toMatchObject({ accountId: REGISTERED, accessMode: 'account' })
  })

  it('rejects a second sequential trial for the same guest account', async () => {
    await startGuestTrial()

    const second = await startSession('guest-a')

    expect(second.statusCode).toBe(403)
    assertResponseMatchesSchema(harness.app, 'POST', '/sessions', second, 403)
    expect(second.json<{ error: { code: string } }>().error.code).toBe(
      'sessions.GUEST_TRIAL_CONSUMED',
    )
    await expect(
      harness.container.repositories.sessions.listByAccount({
        accountId: GUEST_A,
        limit: 10,
        cursor: null,
      }),
    ).resolves.toHaveLength(1)
  })

  it('creates exactly one session when two concurrent requests race for the same guest', async () => {
    const [first, second] = await Promise.all([startSession('guest-a'), startSession('guest-a')])

    const statuses = [first.statusCode, second.statusCode].sort((a, b) => a - b)
    expect(statuses).toEqual([201, 403])
    assertResponseMatchesSchema(harness.app, 'POST', '/sessions', first, first.statusCode)
    assertResponseMatchesSchema(harness.app, 'POST', '/sessions', second, second.statusCode)
    const rejected = first.statusCode === 403 ? first : second
    expect(rejected.json<{ error: { code: string } }>().error.code).toBe(
      'sessions.GUEST_TRIAL_CONSUMED',
    )

    await expect(
      harness.container.repositories.sessions.listByAccount({
        accountId: GUEST_A,
        limit: 10,
        cursor: null,
      }),
    ).resolves.toHaveLength(1)
    expect(
      harness.eventBus.published.filter((event) => event.eventName === 'session_started'),
    ).toHaveLength(1)
  })

  it('rejects the blocked guest without touching the previous session or the theme pool', async () => {
    const sessionId = await startGuestTrial()
    harness.clock.set(new Date(harness.clock.now().getTime() + 60 * 60 * 1000))
    harness.reset()
    harness.accounts.registerIdentity('guest-a', GUEST_A)
    harness.accounts.registerGuest(GUEST_A)

    const response = await startSession('guest-a')

    expect(response.statusCode).toBe(403)
    assertResponseMatchesSchema(harness.app, 'POST', '/sessions', response, 403)
    await expect(
      harness.container.repositories.sessions.findById(sessionId),
    ).resolves.toMatchObject({ state: 'in_progress', expiredReason: null })
    expect(harness.eventBus.published).toEqual([])
  })

  it.each(['expired', 'completed', 'failed', 'deleted'] as const)(
    'keeps the trial consumed once the session ends as %s',
    async (state) => {
      const sessionId = await startGuestTrial()
      await setPersistedSessionState(harness.prisma, sessionId, state)

      const response = await startSession('guest-a')

      expect(response.statusCode).toBe(403)
      assertResponseMatchesSchema(harness.app, 'POST', '/sessions', response, 403)
      expect(response.json<{ error: { code: string } }>().error.code).toBe(
        'sessions.GUEST_TRIAL_CONSUMED',
      )
    },
  )

  it('lets a registered account start again after its previous session ended', async () => {
    const response = await startSession('registered')
    expect(response.statusCode).toBe(201)
    assertResponseMatchesSchema(harness.app, 'POST', '/sessions', response, 201)
    const { sessionId } = response.json<{ data: { readonly sessionId: string } }>().data
    await setPersistedSessionState(harness.prisma, sessionId, 'completed')

    const second = await startSession('registered')
    expect(second.statusCode).toBe(201)
    assertResponseMatchesSchema(harness.app, 'POST', '/sessions', second, 201)
  })

  it('gives every guest account a trial of its own', async () => {
    await startGuestTrial('guest-a')

    const guestB = await startSession('guest-b')
    expect(guestB.statusCode).toBe(201)
    assertResponseMatchesSchema(harness.app, 'POST', '/sessions', guestB, 201)
    await expect(harness.container.repositories.sessions.hasGuestTrial(GUEST_A)).resolves.toBe(true)
    await expect(harness.container.repositories.sessions.hasGuestTrial(GUEST_B)).resolves.toBe(true)
  })

  it('walks the whole trial pipeline and keeps it readable by its own guest', async () => {
    const sessionId = await startGuestTrial()
    harness.clock.set(new Date(harness.clock.now().getTime() + 4 * 60 * 1000))

    const recording = await harness.app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/recording`,
      headers: { authorization: 'Bearer guest-a' },
    })
    expect(recording.statusCode).toBe(200)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/recording',
      recording,
      200,
    )

    const uploadUrl = await harness.app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/audio/upload-url`,
      headers: { authorization: 'Bearer guest-a' },
    })
    expect(uploadUrl.statusCode).toBe(200)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/audio/upload-url',
      uploadUrl,
      200,
    )

    harness.storage.putObject(audioPath(GUEST_A, sessionId), await readAudioFixture('valid.webm'))
    const confirmed = await harness.app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/audio/confirm`,
      headers: { authorization: 'Bearer guest-a' },
    })

    expect(confirmed.statusCode).toBe(200)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/audio/confirm',
      confirmed,
      200,
    )
    await expect(
      harness.container.repositories.sessions.findById(sessionId),
    ).resolves.toMatchObject({ state: 'processing', accessMode: 'guest_trial' })
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual([
      'session_started',
      'recording_submitted',
    ])

    await harness.eventBus.deliver({
      eventId: '00000000-0000-4000-8000-000000000045',
      eventName: 'analysis_completed',
      occurredAt: harness.clock.now(),
      version: 1,
      payload: { sessionId },
    })
    await expect(
      harness.container.repositories.sessions.findById(sessionId),
    ).resolves.toMatchObject({ state: 'completed', accessMode: 'guest_trial' })

    const playback = await harness.app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/audio/playback-url`,
      headers: { authorization: 'Bearer guest-a' },
    })
    expect(playback.statusCode).toBe(200)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/audio/playback-url',
      playback,
      200,
    )
  })

  it('hides the session, history and audio of guest A from guest B and from a registered account', async () => {
    const sessionId = await startGuestTrial()

    for (const token of ['guest-b', 'registered']) {
      const active = await harness.app.inject({
        method: 'GET',
        url: '/sessions/active',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(active.statusCode).toBe(200)
      assertResponseMatchesSchema(harness.app, 'GET', '/sessions/active', active, 200)
      expect(active.json()).toEqual({ data: null })

      const history = await harness.app.inject({
        method: 'GET',
        url: '/sessions',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(history.statusCode).toBe(200)
      assertResponseMatchesSchema(harness.app, 'GET', '/sessions', history, 200)
      expect(history.json<{ data: unknown[] }>().data).toEqual([])

      const inaccessibleRoutes = [
        { suffix: 'recording', route: '/sessions/{sessionId}/recording' },
        { suffix: 'audio/upload-url', route: '/sessions/{sessionId}/audio/upload-url' },
        { suffix: 'audio/playback-url', route: '/sessions/{sessionId}/audio/playback-url' },
        { suffix: 'abandon', route: '/sessions/{sessionId}/abandon' },
      ]
      for (const { suffix, route } of inaccessibleRoutes) {
        const response = await harness.app.inject({
          method: 'POST',
          url: `/sessions/${sessionId}/${suffix}`,
          headers: { authorization: `Bearer ${token}` },
        })
        expect(response.statusCode).toBe(404)
        assertResponseMatchesSchema(harness.app, 'POST', route, response, 404)
        expect(response.json<{ error: { code: string } }>().error.code).toBe(
          'sessions.SESSION_NOT_FOUND',
        )
      }

      const deletion = await harness.app.inject({
        method: 'DELETE',
        url: `/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(deletion.statusCode).toBe(404)
      assertResponseMatchesSchema(harness.app, 'DELETE', '/sessions/{sessionId}', deletion, 404)
    }

    await expect(
      harness.container.repositories.sessions.findById(sessionId),
    ).resolves.toMatchObject({ accountId: GUEST_A, state: 'in_progress' })
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual(['session_started'])
  })
})
