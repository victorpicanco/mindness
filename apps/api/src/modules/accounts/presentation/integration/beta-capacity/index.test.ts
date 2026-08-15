import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  buildAccountsTestApp,
  type AccountsTestApp,
} from '@/modules/accounts/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearAccountsData,
  seedAccounts,
} from '@/modules/accounts/composition/integration-fixtures.js'

const BETA_CAPACITY = 100

const password = 'Strong_password1!'
const captchaToken = 'captcha-token'

let harness: AccountsTestApp

async function confirmedSession(email: string): Promise<string> {
  await harness.app.inject({
    method: 'POST',
    url: '/auth/sign-up',
    payload: { email, password, captchaToken },
  })
  harness.authIdentityProvider.confirmEmail(email)

  const response = await harness.app.inject({
    method: 'POST',
    url: '/auth/sign-in',
    payload: { email, password, captchaToken },
  })

  return response.json<{ data: { accessToken: string } }>().data.accessToken
}

function provision(accessToken: string) {
  return harness.app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { timeZone: null },
  })
}

beforeAll(async () => {
  harness = await buildAccountsTestApp({ databaseUrl: inject('databaseUrl') })
})

afterAll(async () => {
  await harness.close()
})

beforeEach(async () => {
  await clearAccountsData(harness.prisma)
  harness.reset()
})

describe('beta capacity', () => {
  it('never persists more than one hundred accounts under concurrent provisioning', async () => {
    await seedAccounts(harness.repositories.accounts, BETA_CAPACITY - 1, harness.clock.now())
    const tokens = await Promise.all(
      Array.from({ length: 6 }, (_, index) => confirmedSession(`racer-${index}@example.com`)),
    )

    const responses = await Promise.all(tokens.map((token) => provision(token)))
    const statuses = responses.map((response) => response.statusCode)

    await expect(harness.repositories.accounts.count()).resolves.toBe(BETA_CAPACITY)
    expect(statuses.filter((status) => status === 200)).toHaveLength(1)
    expect(statuses.filter((status) => status === 409)).toHaveLength(5)
  })

  it('answers the attempt beyond the ceiling with the beta capacity error', async () => {
    await seedAccounts(harness.repositories.accounts, BETA_CAPACITY, harness.clock.now())
    const accessToken = await confirmedSession('one-too-many@example.com')

    const response = await provision(accessToken)

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      error: { code: 'accounts.BETA_CAPACITY_REACHED', issues: null },
    })
    assertResponseMatchesSchema(harness.app, 'POST', '/accounts', response, 409)
    await expect(harness.repositories.accounts.count()).resolves.toBe(BETA_CAPACITY)
  })

  it('emits beta_capacity_reached when the ceiling turns an attempt away', async () => {
    await seedAccounts(harness.repositories.accounts, BETA_CAPACITY, harness.clock.now())
    const accessToken = await confirmedSession('one-too-many@example.com')

    await provision(accessToken)

    expect(harness.eventBus.published).toContainEqual(
      expect.objectContaining({
        eventName: 'beta_capacity_reached',
        payload: { accountId: null, plan: 'free', capacity: BETA_CAPACITY },
      }),
    )
  })

  it('still provisions while the ceiling has room', async () => {
    await seedAccounts(harness.repositories.accounts, BETA_CAPACITY - 1, harness.clock.now())
    const accessToken = await confirmedSession('last-seat@example.com')

    const response = await provision(accessToken)

    expect(response.statusCode).toBe(200)
    await expect(harness.repositories.accounts.count()).resolves.toBe(BETA_CAPACITY)
    expect(harness.eventBus.published.map((event) => event.eventName)).toContain('account_created')
  })
})
