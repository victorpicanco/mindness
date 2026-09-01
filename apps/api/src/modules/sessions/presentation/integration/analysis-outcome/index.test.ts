import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  createSessionsIntegrationContainer,
  type SessionsIntegrationContainer,
} from '@/modules/sessions/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearSessionsData,
  readAudioFixture,
} from '@/modules/sessions/composition/integration-fixtures.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const ACCOUNT_A = '00000000-0000-4000-8000-000000000041'
const ACCOUNT_B = '00000000-0000-4000-8000-000000000042'
const THEME_ID = '00000000-0000-4000-8000-000000000043'

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
  harness.accounts.registerIdentity('account-a', ACCOUNT_A)
  harness.accounts.registerIdentity('account-b', ACCOUNT_B)
  harness.themes.registerEligibleTheme({
    categorySlug: 'analysis',
    difficulty: 'balanced',
    themeId: THEME_ID,
  })
})

describe('analysis outcome integration', () => {
  it('fails a timed-out session and accepts its replacement', async () => {
    const started = await harness.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { authorization: 'Bearer account-a' },
      payload: { difficulty: 'balanced', categorySlug: 'analysis', searchWindowMinutes: 4 },
    })
    expect(started.statusCode).toBe(201)
    const sessionId = started.json<{ data: { readonly sessionId: string } }>().data.sessionId
    const uploadUrl = await harness.app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/audio/upload-url`,
      headers: { authorization: 'Bearer account-a' },
    })
    expect(uploadUrl.statusCode).toBe(200)
    harness.storage.putObject(
      `${ACCOUNT_A}/${sessionId}/audio`,
      await readAudioFixture('valid.webm'),
    )
    const confirmed = await harness.app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/audio/confirm`,
      headers: { authorization: 'Bearer account-a' },
    })
    expect(confirmed.statusCode).toBe(200)
    const event: IntegrationEvent<'analysis_timeout', { readonly sessionId: string }> = {
      eventId: 'analysis-timeout-event',
      eventName: 'analysis_timeout',
      occurredAt: harness.clock.now(),
      version: 1,
      payload: { sessionId },
    }

    await harness.eventBus.deliver(event)

    const active = await harness.app.inject({
      method: 'GET',
      url: '/sessions/active',
      headers: { authorization: 'Bearer account-a' },
    })
    expect(active.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'GET', '/sessions/active', active, 200)
    expect(active.json()).toEqual({ data: null })
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({
      failureReason: 'analysis_timeout',
      state: 'failed',
    })

    await harness.eventBus.deliver(event)

    const crossAccount = await harness.app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/abandon`,
      headers: { authorization: 'Bearer account-b' },
    })
    expect(crossAccount.statusCode).toBe(404)
    assertResponseMatchesSchema(
      harness.app,
      'POST',
      '/sessions/{sessionId}/abandon',
      crossAccount,
      404,
    )

    const replacement = await harness.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { authorization: 'Bearer account-a' },
      payload: { difficulty: 'balanced', categorySlug: 'analysis', searchWindowMinutes: 4 },
    })
    expect(replacement.statusCode).toBe(201)
    assertResponseMatchesSchema(harness.app, 'POST', '/sessions', replacement, 201)
  })
})
