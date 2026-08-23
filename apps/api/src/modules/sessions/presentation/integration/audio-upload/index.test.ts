import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  createSessionsIntegrationContainer,
  type SessionsIntegrationContainer,
} from '@/modules/sessions/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearSessionsData,
  readAudioFixture as readFixture,
} from '@/modules/sessions/composition/integration-fixtures.js'

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000021'
const THEME_ID = '00000000-0000-4000-8000-000000000022'

let harness: SessionsIntegrationContainer
async function start(): Promise<string> {
  const response = await harness.app.inject({
    method: 'POST',
    url: '/sessions',
    headers: { authorization: 'Bearer account-token' },
    payload: { difficulty: 'easy', categorySlug: 'audio', searchWindowMinutes: 3 },
  })
  expect(response.statusCode).toBe(201)
  return response.json<{ data: { readonly sessionId: string } }>().data.sessionId
}
function audioPath(sessionId: string): string {
  return `${ACCOUNT_ID}/${sessionId}/audio`
}
async function requestUpload(sessionId: string): Promise<void> {
  const response = await harness.app.inject({
    method: 'POST',
    url: `/sessions/${sessionId}/audio/upload-url`,
    headers: { authorization: 'Bearer account-token' },
  })
  expect(response.statusCode).toBe(200)
  const body = response.json<{ data: { readonly uploadUrl: string; readonly token: string } }>()
  expect(body.data.uploadUrl.length).toBeGreaterThan(0)
  expect(body.data.token.length).toBeGreaterThan(0)
}
async function confirm(sessionId: string) {
  return harness.app.inject({
    method: 'POST',
    url: `/sessions/${sessionId}/audio/confirm`,
    headers: { authorization: 'Bearer account-token' },
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
  harness.themes.registerEligibleTheme({
    categorySlug: 'audio',
    difficulty: 'easy',
    themeId: THEME_ID,
  })
})

describe('audio upload integration', () => {
  it('confirms a valid uploaded recording with ffmpeg validation', async () => {
    const sessionId = await start()
    await requestUpload(sessionId)
    harness.storage.putObject(audioPath(sessionId), await readFixture('valid.webm'))
    const response = await confirm(sessionId)
    expect(response.statusCode).toBe(200)
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId }, include: { audio: true } }),
    ).resolves.toMatchObject({
      state: 'processing',
      audio: { storagePath: audioPath(sessionId), contentType: 'audio/webm' },
    })
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual([
      'session_started',
      'recording_submitted',
    ])
  })

  it('removes an oversized uploaded object', async () => {
    const sessionId = await start()
    await requestUpload(sessionId)
    harness.storage.putObject(audioPath(sessionId), Buffer.alloc(25 * 1024 * 1024 + 1))
    const response = await confirm(sessionId)
    expect(response.statusCode).toBe(422)
    expect(response.json()).toMatchObject({ error: { code: 'sessions.AUDIO_SIZE_REJECTED' } })
    expect(harness.storage.hasObject(audioPath(sessionId))).toBe(false)
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({ state: 'in_progress' })
  })

  it('removes a non-decodable uploaded object', async () => {
    const sessionId = await start()
    await requestUpload(sessionId)
    harness.storage.putObject(audioPath(sessionId), await readFixture('random-bytes.ogg'))
    const response = await confirm(sessionId)
    expect(response.statusCode).toBe(422)
    expect(response.json()).toMatchObject({ error: { code: 'sessions.AUDIO_VALIDATION_REJECTED' } })
    expect(harness.storage.hasObject(audioPath(sessionId))).toBe(false)
  })

  it('rejects confirmation when no object was uploaded', async () => {
    const sessionId = await start()
    const response = await confirm(sessionId)
    expect(response.statusCode).toBe(422)
    expect(response.json()).toMatchObject({ error: { code: 'sessions.AUDIO_UPLOAD_FAILED' } })
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({ state: 'in_progress' })
    expect(harness.eventBus.published).toHaveLength(1)
  })

  it('refuses the credential and the confirmation once the window elapsed', async () => {
    const sessionId = await start()
    harness.storage.putObject(audioPath(sessionId), await readFixture('valid.webm'))
    harness.clock.set(new Date(harness.clock.now().getTime() + 16 * 60 * 1000))

    const credential = await harness.app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/audio/upload-url`,
      headers: { authorization: 'Bearer account-token' },
    })
    expect(credential.statusCode).toBe(409)
    expect(credential.json()).toMatchObject({
      error: { code: 'sessions.SESSION_NOT_IN_PROGRESS' },
    })

    const response = await confirm(sessionId)
    expect(response.statusCode).toBe(409)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/audio/confirm',
      response,
      409,
    )
    expect(response.json()).toMatchObject({ error: { code: 'sessions.SESSION_NOT_IN_PROGRESS' } })

    expect(harness.storage.hasObject(audioPath(sessionId))).toBe(false)
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId }, include: { audio: true } }),
    ).resolves.toMatchObject({ state: 'in_progress', audio: null })
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual(['session_started'])
  })

  it('accepts a recording produced by a browser that records audio/mp4', async () => {
    const sessionId = await start()
    await requestUpload(sessionId)
    harness.storage.putObject(audioPath(sessionId), await readFixture('valid.m4a'))

    const response = await confirm(sessionId)

    expect(response.statusCode).toBe(200)
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId }, include: { audio: true } }),
    ).resolves.toMatchObject({
      state: 'processing',
      audio: { storagePath: audioPath(sessionId), contentType: 'audio/mp4' },
    })
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual([
      'session_started',
      'recording_submitted',
    ])
  })
})
