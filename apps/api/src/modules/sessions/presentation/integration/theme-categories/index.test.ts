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
})
