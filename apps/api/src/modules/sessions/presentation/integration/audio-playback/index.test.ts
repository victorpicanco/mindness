import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
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

const ACCOUNT_A = '00000000-0000-4000-8000-000000000071'
const ACCOUNT_B = '00000000-0000-4000-8000-000000000072'
const THEME_ID = '00000000-0000-4000-8000-000000000073'
const SESSION_ID = '00000000-0000-4000-8000-000000000074'
const STORAGE_PATH = `${ACCOUNT_A}/${SESSION_ID}/audio`

interface PlaybackUrlResponseBody {
  readonly data: { readonly signedUrl: string; readonly expiresAt: string }
}

let harness: SessionsIntegrationContainer

async function seedCompletedSessionWithAudio(): Promise<void> {
  const session = Session.reconstitute({
    sessionId: SESSION_ID,
    accountId: ACCOUNT_A,
    themeId: THEME_ID,
    configuration: SessionConfiguration.create({
      difficulty: 'balanced',
      categorySlug: 'audio-playback',
      searchWindowMinutes: 4,
    }),
    state: 'completed',
    createdAt: SESSIONS_TEST_NOW,
    expiresAt: new Date(SESSIONS_TEST_NOW.getTime() + 15 * 60 * 1000),
    expiredReason: null,
    expiredAt: null,
    recordedAt: SESSIONS_TEST_NOW,
    totalScore: 80,
    completedAt: SESSIONS_TEST_NOW,
    audio: SessionAudio.create({
      id: SESSION_ID,
      durationSeconds: 30,
      sizeBytes: 1024,
      contentType: 'audio/webm',
      storagePath: STORAGE_PATH,
    }),
  })

  await harness.container.repositories.sessions.save(session)
  harness.storage.putObject(STORAGE_PATH, Buffer.from('audio-bytes'))
}

async function requestPlaybackUrl(
  accessToken: string,
): Promise<Awaited<ReturnType<typeof harness.app.inject>>> {
  return harness.app.inject({
    method: 'POST',
    url: `/sessions/${SESSION_ID}/audio/playback-url`,
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
  await seedCompletedSessionWithAudio()
})

describe('audio playback credential integration', () => {
  it('issues a signed url with an expiry window between 60 and 300 seconds, valid only until it expires', async () => {
    const response = await requestPlaybackUrl('account-a')

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/audio/playback-url',
      response,
      200,
    )
    const body = response.json<PlaybackUrlResponseBody>()

    const expiresAt = new Date(body.data.expiresAt)
    const windowSeconds = (expiresAt.getTime() - harness.clock.now().getTime()) / 1_000
    expect(windowSeconds).toBeGreaterThanOrEqual(60)
    expect(windowSeconds).toBeLessThanOrEqual(300)

    expect(harness.storage.isSignedUrlValidAt(body.data.signedUrl, harness.clock.now())).toBe(true)

    harness.clock.set(new Date(expiresAt.getTime() + 1_000))
    expect(harness.storage.isSignedUrlValidAt(body.data.signedUrl, harness.clock.now())).toBe(false)
  })

  it('never leaks the signed url in logs or published events, and publishes no event for this read', async () => {
    const response = await requestPlaybackUrl('account-a')

    expect(response.statusCode).toBe(200)
    const body = response.json<PlaybackUrlResponseBody>()

    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['x-content-type-options']).toBe('nosniff')

    expect(harness.logs.length).toBeGreaterThan(0)
    for (const line of harness.logs) {
      expect(line).not.toContain(body.data.signedUrl)
    }
    expect(harness.eventBus.published).toEqual([])
  })

  it('responds not found when the audio object is missing from storage', async () => {
    harness.storage.reset()

    const response = await requestPlaybackUrl('account-a')

    expect(response.statusCode).toBe(404)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/audio/playback-url',
      response,
      404,
    )
    expect(response.json()).toMatchObject({ error: { code: 'sessions.AUDIO_UNAVAILABLE' } })
  })

  it('responds not found for account B requesting account A audio, and signs nothing', async () => {
    harness.accounts.registerProfile(ACCOUNT_B, { plan: 'free', timeZone: 'UTC' })

    const response = await requestPlaybackUrl('account-b')

    expect(response.statusCode).toBe(404)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/audio/playback-url',
      response,
      404,
    )
    expect(response.json()).toMatchObject({ error: { code: 'sessions.SESSION_NOT_FOUND' } })
  })

  it('responds not found once the session has been deleted', async () => {
    const deleted = await harness.app.inject({
      method: 'DELETE',
      url: `/sessions/${SESSION_ID}`,
      headers: { authorization: 'Bearer account-a' },
    })
    expect(deleted.statusCode).toBe(200)

    const response = await requestPlaybackUrl('account-a')

    expect(response.statusCode).toBe(404)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/audio/playback-url',
      response,
      404,
    )
    expect(response.json()).toMatchObject({ error: { code: 'sessions.SESSION_NOT_FOUND' } })
  })
})
