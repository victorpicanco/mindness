import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  buildAccountsTestApp,
  type AccountsTestApp,
} from '@/modules/accounts/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearAccountsData,
} from '@/modules/accounts/composition/integration-fixtures.js'

const credentials = {
  email: 'person@example.com',
  password: 'Strong_password1!',
  captchaToken: 'captcha-token',
}

let harness: AccountsTestApp

async function confirmedSession(email = credentials.email): Promise<string> {
  await harness.app.inject({
    method: 'POST',
    url: '/auth/sign-up',
    payload: { ...credentials, email },
  })
  harness.authIdentityProvider.confirmEmail(email)

  const response = await harness.app.inject({
    method: 'POST',
    url: '/auth/sign-in',
    payload: { ...credentials, email },
  })

  return response.json<{ data: { accessToken: string } }>().data.accessToken
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

describe('account onboarding', () => {
  it('answers sign-up with the neutral message and no account yet', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/auth/sign-up',
      payload: credentials,
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toEqual({
      data: {
        message:
          'Verifique seu e-mail para continuar, caso exista uma conta elegível para este endereço.',
      },
    })
    assertResponseMatchesSchema(harness.app, 'POST', '/auth/sign-up', response, 202)
    await expect(harness.repositories.accounts.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toHaveLength(0)
  })

  it('refuses a session while the email is not confirmed', async () => {
    await harness.app.inject({ method: 'POST', url: '/auth/sign-up', payload: credentials })

    const response = await harness.app.inject({
      method: 'POST',
      url: '/auth/sign-in',
      payload: credentials,
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({
      error: { code: 'accounts.EMAIL_NOT_CONFIRMED', issues: null },
    })
    assertResponseMatchesSchema(harness.app, 'POST', '/auth/sign-in', response, 401)
    expect(harness.eventBus.published.map((event) => event.eventName)).toEqual(['login_rejected'])
  })

  it('provisions the free account of a confirmed identity', async () => {
    const accessToken = await confirmedSession()

    const response = await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { timeZone: 'Europe/Lisbon' },
    })

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'POST', '/accounts', response, 200)

    const persisted = await harness.repositories.accounts.findByEmail(credentials.email)
    expect(persisted).toMatchObject({ plan: 'free', status: 'accessible' })
    expect(persisted?.timeZone.value).toBe('Europe/Lisbon')

    expect(harness.eventBus.published).toContainEqual(
      expect.objectContaining({
        eventName: 'account_created',
        payload: {
          accountId: persisted?.id,
          plan: 'free',
          origin: 'api',
          authenticationMethod: 'password',
        },
      }),
    )
  })

  it('answers the same neutral message when the identity already has an account', async () => {
    const accessToken = await confirmedSession()
    const headers = { authorization: `Bearer ${accessToken}` }
    const first = await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers,
      payload: { timeZone: null },
    })

    const second = await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers,
      payload: { timeZone: null },
    })

    expect(second.statusCode).toBe(200)
    expect(second.json()).toEqual(first.json())
    await expect(harness.repositories.accounts.count()).resolves.toBe(1)
    expect(harness.eventBus.published.map((event) => event.eventName)).toContain(
      'account_creation_rejected',
    )
  })

  it('refuses an accountId supplied by the client', async () => {
    const accessToken = await confirmedSession()

    const response = await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { timeZone: null, accountId: 'af09c3e2-0f5c-4a7d-9d31-2f0a3f7b1d54' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: { code: 'shared.VALIDATION_FAILED' } })
    assertResponseMatchesSchema(harness.app, 'POST', '/accounts', response, 400)
    await expect(harness.repositories.accounts.count()).resolves.toBe(0)
  })

  it('shows each account only the profile behind its own token', async () => {
    const tokenA = await confirmedSession('a@example.com')
    await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { timeZone: null },
    })
    const tokenB = await confirmedSession('b@example.com')
    await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { timeZone: null },
    })

    const response = await harness.app.inject({
      method: 'GET',
      url: '/accounts/me',
      headers: { authorization: `Bearer ${tokenB}` },
    })

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'GET', '/accounts/me', response, 200)
    expect(response.json<{ data: { email: string } }>().data.email).toBe('b@example.com')
  })

  it('refuses an unauthenticated profile read', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/accounts/me' })

    expect(response.statusCode).toBe(401)
    assertResponseMatchesSchema(harness.app, 'GET', '/accounts/me', response, 401)
  })
})
