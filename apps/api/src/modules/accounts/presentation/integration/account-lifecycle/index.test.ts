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

async function provisionedPasswordAccount(email: string): Promise<string> {
  const accessToken = await confirmedPasswordSession(email)
  await provision(accessToken)
  return accessToken
}

function provision(accessToken: string, timeZone: string | null = null) {
  return harness.app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { timeZone },
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

describe('account lifecycle', () => {
  it('provisions a password account and publishes an attributed creation event', async () => {
    const email = 'password-account@example.com'
    const accessToken = await confirmedPasswordSession(email)

    const response = await provision(accessToken, 'Europe/Lisbon')

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'POST', '/accounts', response, 200)
    const persisted = await harness.repositories.accounts.findByEmail(email)
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

  it('records consent before practice eligibility becomes available', async () => {
    const email = 'consent@example.com'
    const accessToken = await provisionedPasswordAccount(email)
    const account = await harness.repositories.accounts.findByEmail(email)
    expect(await harness.container.facade.canStartPractice(account?.id ?? '')).toBe(false)

    const response = await harness.app.inject({
      method: 'POST',
      url: '/accounts/me/consent',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'POST', '/accounts/me/consent', response, 200)
    const persisted = await harness.repositories.accounts.findByEmail(email)
    expect(persisted?.voiceConsent).toMatchObject({
      purpose: 'voice_recording_and_analysis',
      version: '2026-08-15',
    })
    expect(await harness.container.facade.canStartPractice(account?.id ?? '')).toBe(true)
    expect(harness.eventBus.published.map((event) => event.eventName)).toContain('consent_accepted')
  })

  it('updates only the account selected by the validated token', async () => {
    const tokenA = await provisionedPasswordAccount('owner-a@example.com')
    const tokenB = await provisionedPasswordAccount('owner-b@example.com')
    const accountA = await harness.repositories.accounts.findByEmail('owner-a@example.com')

    const response = await harness.app.inject({
      method: 'PATCH',
      url: '/accounts/me/time-zone',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { timeZone: 'Europe/Paris', accountId: accountA?.id },
    })
    const profileA = await harness.app.inject({
      method: 'GET',
      url: '/accounts/me',
      headers: { authorization: `Bearer ${tokenA}` },
    })

    expect(response.statusCode).toBe(400)
    assertResponseMatchesSchema(harness.app, 'PATCH', '/accounts/me/time-zone', response, 400)
    expect(profileA.statusCode).toBe(200)
    expect(profileA.json<{ data: { timeZone: string } }>().data.timeZone).toBe('America/Sao_Paulo')
  })

  it('updates the time zone without replacing the authenticated session', async () => {
    const email = 'time-zone@example.com'
    const accessToken = await provisionedPasswordAccount(email)
    const eventCount = harness.eventBus.published.length

    const response = await harness.app.inject({
      method: 'PATCH',
      url: '/accounts/me/time-zone',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { timeZone: 'Asia/Tokyo' },
    })

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'PATCH', '/accounts/me/time-zone', response, 200)
    const persisted = await harness.repositories.accounts.findByEmail(email)
    expect(persisted?.timeZone.value).toBe('Asia/Tokyo')
    expect(persisted?.hasCurrentSession(persisted.currentSessionId ?? '')).toBe(true)
    expect(harness.eventBus.published).toHaveLength(eventCount)
  })

  it('cancels billing, makes a deleted account inaccessible and schedules its removal', async () => {
    const email = 'deletion@example.com'
    const accessToken = await provisionedPasswordAccount(email)
    const account = await harness.repositories.accounts.findByEmail(email)

    const response = await harness.app.inject({
      method: 'DELETE',
      url: '/accounts/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    const afterDeletion = await harness.app.inject({
      method: 'GET',
      url: '/accounts/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'DELETE', '/accounts/me', response, 200)
    const persisted = await harness.repositories.accounts.findByEmail(email)
    expect(persisted).toMatchObject({ status: 'deletion_pending', currentSessionId: null })
    expect(harness.subscriptionCancellation.canceled).toEqual([account?.id])
    expect(harness.eventBus.published).toContainEqual(
      expect.objectContaining({
        eventName: 'account_deletion_requested',
        payload: {
          accountId: account?.id,
          plan: 'free',
          scheduledFor: response.json<{ data: { scheduledFor: string } }>().data.scheduledFor,
        },
      }),
    )
    expect(afterDeletion.statusCode).toBe(401)
    assertResponseMatchesSchema(harness.app, 'GET', '/accounts/me', afterDeletion, 401)
  })
})
