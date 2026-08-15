import { describe, expect, it } from 'vitest'

import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'
import type { SignUpWithPasswordParams } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

import { SignUpUseCase } from './index.js'

const NEUTRAL_MESSAGE =
  'Verifique seu e-mail para continuar, caso exista uma conta elegível para este endereço.'

const credentials = {
  email: 'Person@Example.com',
  password: 'Strong_password1!',
  captchaToken: 'captcha-token',
}

class RecordingIdentityRegistrar {
  readonly registered: SignUpWithPasswordParams[] = []
  rejection: AuthenticationRejectedError | null = null

  signUpWithPassword(params: SignUpWithPasswordParams): Promise<void> {
    if (this.rejection !== null) return Promise.reject(this.rejection)
    this.registered.push(params)
    return Promise.resolve()
  }
}

function createHarness() {
  const authIdentityProvider = new RecordingIdentityRegistrar()

  return { authIdentityProvider, useCase: new SignUpUseCase({ authIdentityProvider }) }
}

describe('SignUpUseCase', () => {
  it('registers the identity and answers with the neutral account message', async () => {
    const harness = createHarness()

    await expect(harness.useCase.execute(credentials)).resolves.toEqual({
      message: NEUTRAL_MESSAGE,
    })

    expect(harness.authIdentityProvider.registered).toEqual([
      {
        email: 'person@example.com',
        password: credentials.password,
        captchaToken: 'captcha-token',
      },
    ])
  })

  it('rejects a password that does not meet the product rule before calling the provider', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({ ...credentials, password: 'short' }),
    ).rejects.toBeInstanceOf(InvalidAccountValueError)

    expect(harness.authIdentityProvider.registered).toHaveLength(0)
  })

  it('rejects an invalid email before calling the provider', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({ ...credentials, email: 'not-an-email' }),
    ).rejects.toMatchObject({ context: { field: 'email' } })

    expect(harness.authIdentityProvider.registered).toHaveLength(0)
  })

  it('propagates a provider rejection such as a leaked password', async () => {
    const harness = createHarness()
    harness.authIdentityProvider.rejection = new AuthenticationRejectedError('weak_password')

    await expect(harness.useCase.execute(credentials)).rejects.toMatchObject({
      code: 'accounts.AUTHENTICATION_REJECTED',
      context: { reason: 'weak_password' },
    })
  })
})
