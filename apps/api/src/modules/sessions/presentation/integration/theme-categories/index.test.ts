import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  createSessionsIntegrationContainer,
  type SessionsIntegrationContainer,
} from '@/modules/sessions/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearSessionsData,
} from '@/modules/sessions/composition/integration-fixtures.js'

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000001'
const CATEGORY_ID = '00000000-0000-4000-8000-000000000002'

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
})

describe('theme categories integration', () => {
  it('returns the eligible theme categories', async () => {
    harness.themes.registerEligibleTheme({
      categoryId: CATEGORY_ID,
      categorySlug: 'focus',
      categoryName: 'Focus',
      difficulty: 'balanced',
      themeId: '00000000-0000-4000-8000-000000000003',
    })

    const response = await harness.app.inject({
      method: 'GET',
      url: '/sessions/theme-categories',
      headers: { authorization: 'Bearer access-token' },
    })

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'GET', '/sessions/theme-categories', response, 200)
    expect(response.json()).toStrictEqual({
      data: [{ categoryId: CATEGORY_ID, slug: 'focus', name: 'Focus' }],
    })
  })

  it('returns the eligible theme categories without an authorization header', async () => {
    harness.themes.registerEligibleTheme({
      categoryId: CATEGORY_ID,
      categorySlug: 'focus',
      categoryName: 'Focus',
      difficulty: 'balanced',
      themeId: '00000000-0000-4000-8000-000000000003',
    })

    const response = await harness.app.inject({
      method: 'GET',
      url: '/sessions/theme-categories',
    })

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'GET', '/sessions/theme-categories', response, 200)
    expect(response.json()).toStrictEqual({
      data: [{ categoryId: CATEGORY_ID, slug: 'focus', name: 'Focus' }],
    })
  })

  it('ignores an unusable authorization header instead of rejecting the request', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/sessions/theme-categories',
      headers: { authorization: 'Bearer unknown-token' },
    })

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'GET', '/sessions/theme-categories', response, 200)
  })

  it('rejects a query parameter the public contract does not declare', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/sessions/theme-categories?accountId=00000000-0000-4000-8000-000000000001',
    })

    expect(response.statusCode).toBe(400)
    assertResponseMatchesSchema(harness.app, 'GET', '/sessions/theme-categories', response, 400)
  })

  it('keeps every other session route behind a valid identity', async () => {
    const protectedRequests = [
      { method: 'GET' as const, url: '/sessions', route: '/sessions' },
      { method: 'GET' as const, url: '/sessions/active', route: '/sessions/active' },
      {
        method: 'DELETE' as const,
        url: '/sessions/00000000-0000-4000-8000-000000000009',
        route: '/sessions/{sessionId}',
      },
      {
        method: 'POST' as const,
        url: '/sessions/00000000-0000-4000-8000-000000000009/recording',
        route: '/sessions/{sessionId}/recording',
      },
      {
        method: 'POST' as const,
        url: '/sessions/00000000-0000-4000-8000-000000000009/audio/upload-url',
        route: '/sessions/{sessionId}/audio/upload-url',
      },
      {
        method: 'POST' as const,
        url: '/sessions/00000000-0000-4000-8000-000000000009/audio/confirm',
        route: '/sessions/{sessionId}/audio/confirm',
      },
      {
        method: 'POST' as const,
        url: '/sessions/00000000-0000-4000-8000-000000000009/audio/playback-url',
        route: '/sessions/{sessionId}/audio/playback-url',
      },
      {
        method: 'POST' as const,
        url: '/sessions/00000000-0000-4000-8000-000000000009/abandon',
        route: '/sessions/{sessionId}/abandon',
      },
      {
        method: 'POST' as const,
        url: '/sessions/00000000-0000-4000-8000-000000000009/microphone-permission-denied',
        route: '/sessions/{sessionId}/microphone-permission-denied',
      },
    ]

    for (const { method, url, route } of protectedRequests) {
      const response = await harness.app.inject({ method, url })
      expect(response.statusCode).toBe(401)
      assertResponseMatchesSchema(harness.app, method, route, response, 401)
    }

    const start = await harness.app.inject({
      method: 'POST',
      url: '/sessions',
      payload: { difficulty: 'balanced', categorySlug: 'focus', searchWindowMinutes: 4 },
    })
    expect(start.statusCode).toBe(401)
    assertResponseMatchesSchema(harness.app, 'POST', '/sessions', start, 401)
  })
})
