import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  buildAccountsTestApp,
  type AccountsTestApp,
} from '@/modules/accounts/composition/integration-container.js'
import {
  applyGuestAccountsMigrationToLegacyRows,
  assertResponseMatchesSchema,
  clearAccountsData,
  insertAccountForConstraintCheck,
} from '@/modules/accounts/composition/integration-fixtures.js'
import { RateLimitedError } from '@/modules/accounts/domain/errors/rate-limited-error/index.js'

const captchaToken = 'captcha-token'

let harness: AccountsTestApp

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

async function anonymousAccessToken(): Promise<string> {
  const response = await harness.app.inject({
    method: 'POST',
    url: '/auth/anonymous',
    payload: { captchaToken },
  })
  expect(response.statusCode).toBe(200)
  assertResponseMatchesSchema(harness.app, 'POST', '/auth/anonymous', response, 200)

  return response.json<{ data: { accessToken: string } }>().data.accessToken
}

describe('anonymous authentication integration', () => {
  it('backfills pre-existing accounts as registered before enforcing the new constraint', async () => {
    await expect(applyGuestAccountsMigrationToLegacyRows(harness.prisma)).resolves.toEqual([
      { email: 'legacy@example.com', kind: 'registered' },
    ])
  })

  it('issues an anonymous session without any account credential', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/auth/anonymous',
      payload: { captchaToken },
    })

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'POST', '/auth/anonymous', response, 200)
    const body = response.json<{
      data: { readonly accessToken: string; readonly refreshToken: string }
    }>()
    expect(body.data.accessToken.length).toBeGreaterThan(0)
    expect(body.data.refreshToken.length).toBeGreaterThan(0)

    await expect(
      harness.container.useCases.authenticate.execute({ accessToken: body.data.accessToken }),
    ).resolves.toMatchObject({
      accountId: null,
      email: null,
      authenticationMethod: 'anonymous',
    })
  })

  it('gives every anonymous sign-in its own identity', async () => {
    const first = await harness.app.inject({
      method: 'POST',
      url: '/auth/anonymous',
      payload: { captchaToken },
    })
    const second = await harness.app.inject({
      method: 'POST',
      url: '/auth/anonymous',
      payload: { captchaToken },
    })
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'POST', '/auth/anonymous', first, 200)
    assertResponseMatchesSchema(harness.app, 'POST', '/auth/anonymous', second, 200)

    const firstIdentity = await harness.container.useCases.authenticate.execute({
      accessToken: first.json<{ data: { accessToken: string } }>().data.accessToken,
    })
    const secondIdentity = await harness.container.useCases.authenticate.execute({
      accessToken: second.json<{ data: { accessToken: string } }>().data.accessToken,
    })

    expect(firstIdentity.authUserId).not.toBe(secondIdentity.authUserId)
  })

  it('rejects a body that carries any field beyond the captcha token', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/auth/anonymous',
      payload: { captchaToken, accountId: '00000000-0000-4000-8000-000000000001' },
    })

    expect(response.statusCode).toBe(400)
    assertResponseMatchesSchema(harness.app, 'POST', '/auth/anonymous', response, 400)
  })

  it('rejects a body without a captcha token', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/auth/anonymous',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    assertResponseMatchesSchema(harness.app, 'POST', '/auth/anonymous', response, 400)
  })

  it('reports the provider rate limit as a recoverable 429 instead of a credential failure', async () => {
    harness.authIdentityProvider.simulateFailure(new RateLimitedError('authentication'))

    const response = await harness.app.inject({
      method: 'POST',
      url: '/auth/anonymous',
      payload: { captchaToken },
    })

    expect(response.statusCode).toBe(429)
    assertResponseMatchesSchema(harness.app, 'POST', '/auth/anonymous', response, 429)
    expect(response.json<{ error: { code: string } }>().error.code).toBe('accounts.RATE_LIMITED')
  })

  it('provisions a guest account with no email and reports it in the profile', async () => {
    const accessToken = await anonymousAccessToken()

    const provisioned = await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { timeZone: 'Europe/Lisbon' },
    })
    expect(provisioned.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'POST', '/accounts', provisioned, 200)

    const profile = await harness.app.inject({
      method: 'GET',
      url: '/accounts/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(profile.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'GET', '/accounts/me', profile, 200)
    expect(profile.json<{ data: unknown }>().data).toMatchObject({
      accountKind: 'guest',
      authenticationMethod: 'anonymous',
      email: null,
      plan: 'free',
      timeZone: 'Europe/Lisbon',
    })

    const identity = await harness.container.useCases.authenticate.execute({ accessToken })
    const account = await harness.repositories.accounts.findByAuthUserId(identity.authUserId)
    expect(account).toMatchObject({ kind: 'guest', email: null })

    const created = harness.eventBus.published.find(
      (event) => event.eventName === 'account_created',
    )
    expect(created?.payload).toEqual({
      accountId: account?.id,
      plan: 'free',
      origin: 'api',
      authenticationMethod: 'anonymous',
    })
  })

  it('gives two guests without an email two separate accounts', async () => {
    const firstToken = await anonymousAccessToken()
    const firstIdentity = await harness.container.useCases.authenticate.execute({
      accessToken: firstToken,
    })
    const first = await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers: { authorization: `Bearer ${firstToken}` },
      payload: { timeZone: null },
    })
    expect(first.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'POST', '/accounts', first, 200)

    const secondToken = await anonymousAccessToken()
    const secondIdentity = await harness.container.useCases.authenticate.execute({
      accessToken: secondToken,
    })
    const second = await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers: { authorization: `Bearer ${secondToken}` },
      payload: { timeZone: null },
    })
    expect(second.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'POST', '/accounts', second, 200)

    const firstAccount = await harness.repositories.accounts.findByAuthUserId(
      firstIdentity.authUserId,
    )
    const secondAccount = await harness.repositories.accounts.findByAuthUserId(
      secondIdentity.authUserId,
    )
    expect(firstAccount).toMatchObject({ kind: 'guest', email: null })
    expect(secondAccount).toMatchObject({ kind: 'guest', email: null })
    expect(firstAccount?.id).not.toBe(secondAccount?.id)
  })

  it('refuses to give a guest identity a password', async () => {
    const accessToken = await anonymousAccessToken()
    const provisioned = await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { timeZone: null },
    })
    expect(provisioned.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'POST', '/accounts', provisioned, 200)

    const response = await harness.app.inject({
      method: 'POST',
      url: '/auth/password',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { password: 'Strong_password1!' },
    })

    expect(response.statusCode).toBe(403)
    assertResponseMatchesSchema(harness.app, 'POST', '/auth/password', response, 403)
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      'accounts.GUEST_ACCOUNT_NOT_ALLOWED',
    )
  })

  it('refuses a guest row that carries an email address at the database level', async () => {
    await expect(
      insertAccountForConstraintCheck(harness.prisma, {
        id: '00000000-0000-4000-8000-000000000001',
        kind: 'guest',
        email: 'guest@example.com',
        authUserId: 'auth-user-guest',
      }),
    ).rejects.toThrow(/accounts_email_matches_kind_check/)
  })

  it('refuses a registered row without an email address at the database level', async () => {
    await expect(
      insertAccountForConstraintCheck(harness.prisma, {
        id: '00000000-0000-4000-8000-000000000002',
        kind: 'registered',
        email: null,
        authUserId: 'auth-user-registered',
      }),
    ).rejects.toThrow(/accounts_email_matches_kind_check/)
  })
})
