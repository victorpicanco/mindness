import { describe, expect, it } from 'vitest'

import { AuthProviderError } from '@/modules/accounts/domain/errors/auth-provider-error/index.js'
import { CaptchaRejectedError } from '@/modules/accounts/domain/errors/captcha-rejected-error/index.js'
import { RateLimitedError } from '@/modules/accounts/domain/errors/rate-limited-error/index.js'
import type {
  AuthSession,
  SignInAnonymouslyParams,
} from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'

import { SignInAnonymouslyUseCase } from './index.js'

const ISSUED_AT = new Date('2026-09-10T12:00:00.000Z')
const EXPIRES_AT = new Date('2026-09-10T13:00:00.000Z')

const session: AuthSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: EXPIRES_AT,
  identity: {
    authUserId: 'auth-user-1',
    email: null,
    sessionId: 'session-1',
    issuedAt: ISSUED_AT,
    authenticationMethod: 'anonymous',
  },
}

class RecordingAnonymousAuthenticator {
  readonly calls: SignInAnonymouslyParams[] = []
  rejection: BaseError | null = null

  signInAnonymously(params: SignInAnonymouslyParams): Promise<AuthSession> {
    if (this.rejection !== null) return Promise.reject(this.rejection)
    this.calls.push(params)
    return Promise.resolve(session)
  }
}

function createHarness() {
  const authIdentityProvider = new RecordingAnonymousAuthenticator()

  return {
    authIdentityProvider,
    useCase: new SignInAnonymouslyUseCase({ authIdentityProvider }),
  }
}

describe('SignInAnonymouslyUseCase', () => {
  it('issues an anonymous session through the provider', async () => {
    const harness = createHarness()

    await expect(harness.useCase.execute({ captchaToken: 'captcha-token' })).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: EXPIRES_AT.toISOString(),
    })

    expect(harness.authIdentityProvider.calls).toEqual([{ captchaToken: 'captcha-token' }])
  })

  it('propagates a rejected captcha', async () => {
    const harness = createHarness()
    harness.authIdentityProvider.rejection = new CaptchaRejectedError()

    await expect(harness.useCase.execute({ captchaToken: 'captcha-token' })).rejects.toMatchObject({
      code: 'accounts.CAPTCHA_REJECTED',
      httpStatus: 400,
    })
  })

  it('propagates the provider rate limit as a recoverable failure', async () => {
    const harness = createHarness()
    harness.authIdentityProvider.rejection = new RateLimitedError('authentication')

    await expect(harness.useCase.execute({ captchaToken: 'captcha-token' })).rejects.toMatchObject({
      code: 'accounts.RATE_LIMITED',
      httpStatus: 429,
    })
  })

  it('propagates an unexpected provider failure', async () => {
    const harness = createHarness()
    harness.authIdentityProvider.rejection = new AuthProviderError()

    await expect(harness.useCase.execute({ captchaToken: 'captcha-token' })).rejects.toMatchObject({
      code: 'accounts.AUTH_PROVIDER_ERROR',
      httpStatus: 500,
    })
  })
})
