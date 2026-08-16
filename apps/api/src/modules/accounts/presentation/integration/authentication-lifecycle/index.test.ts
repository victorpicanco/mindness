import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  buildAccountsTestApp,
  type AccountsTestApp,
} from '@/modules/accounts/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearAccountsData,
} from '@/modules/accounts/composition/integration-fixtures.js'

const password = 'Strong_password1!'
const captchaToken = 'captcha-token'

let harness: AccountsTestApp

async function confirmedPasswordSession(email: string): Promise<string> {
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

async function googleCookieHeader(): Promise<string> {
  const start = await harness.app.inject({ method: 'GET', url: '/auth/google' })
  const pkceCookie = start.cookies.find((cookie) => cookie.name === 'accounts_google_pkce')
  expect(start.statusCode).toBe(302)
  return `${pkceCookie?.name ?? ''}=${pkceCookie?.value ?? ''}`
}

async function googleSession(email: string): Promise<string> {
  const cookie = await googleCookieHeader()
  harness.authIdentityProvider.registerGoogleCode('google-code', {
    authUserId: 'google-user-1',
    email,
    emailVerified: true,
  })
  const callback = await harness.app.inject({
    method: 'GET',
    url: '/auth/google/callback?code=google-code',
    headers: { cookie },
  })
  expect(callback.statusCode).toBe(200)
  assertResponseMatchesSchema(harness.app, 'GET', '/auth/google/callback', callback, 200)
  return callback.json<{ data: { accessToken: string } }>().data.accessToken
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

describe('authentication lifecycle', () => {
  it('provisions a verified Google identity with its authentication method', async () => {
    const email = 'google-account@example.com'
    const response = await provision(await googleSession(email))

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'POST', '/accounts', response, 200)
    const persisted = await harness.repositories.accounts.findByEmail(email)
    expect(persisted).toMatchObject({ plan: 'free', status: 'accessible' })
    expect(harness.eventBus.published).toContainEqual(
      expect.objectContaining({
        eventName: 'account_created',
        payload: {
          accountId: persisted?.id,
          plan: 'free',
          origin: 'api',
          authenticationMethod: 'google',
        },
      }),
    )
  })

  it('rejects an unverified Google identity without persisting an account', async () => {
    const cookie = await googleCookieHeader()
    harness.authIdentityProvider.registerGoogleCode('unverified-google-code', {
      authUserId: 'unverified-google-user',
      email: 'unverified-google@example.com',
      emailVerified: false,
    })
    const response = await harness.app.inject({
      method: 'GET',
      url: '/auth/google/callback?code=unverified-google-code',
      headers: { cookie },
    })

    expect(response.statusCode).toBe(401)
    assertResponseMatchesSchema(harness.app, 'GET', '/auth/google/callback', response, 401)
    await expect(harness.repositories.accounts.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toContainEqual(
      expect.objectContaining({
        eventName: 'google_login_rejected',
        payload: { accountId: null, plan: null, reason: 'google_failed' },
      }),
    )
  })

  it('records a Google rejection when the PKCE cookie is missing', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/auth/google/callback?code=google-code',
    })

    expect(response.statusCode).toBe(401)
    assertResponseMatchesSchema(harness.app, 'GET', '/auth/google/callback', response, 401)
    await expect(harness.repositories.accounts.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toContainEqual(
      expect.objectContaining({
        eventName: 'google_login_rejected',
        payload: { accountId: null, plan: null, reason: 'google_failed' },
      }),
    )
  })

  it('replaces the previous authenticated session on the next login', async () => {
    const email = 'single-session@example.com'
    const previousToken = await confirmedPasswordSession(email)
    await provision(previousToken)
    const previousAccount = await harness.repositories.accounts.findByEmail(email)
    const currentToken = await confirmedPasswordSession(email)

    const previousResponse = await harness.app.inject({
      method: 'GET',
      url: '/accounts/me',
      headers: { authorization: `Bearer ${previousToken}` },
    })
    const currentResponse = await harness.app.inject({
      method: 'GET',
      url: '/accounts/me',
      headers: { authorization: `Bearer ${currentToken}` },
    })

    expect(previousResponse.statusCode).toBe(401)
    assertResponseMatchesSchema(harness.app, 'GET', '/accounts/me', previousResponse, 401)
    expect(currentResponse.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'GET', '/accounts/me', currentResponse, 200)
    const currentAccount = await harness.repositories.accounts.findByEmail(email)
    expect(currentAccount?.currentSessionId).not.toBe(previousAccount?.currentSessionId)
  })
})
