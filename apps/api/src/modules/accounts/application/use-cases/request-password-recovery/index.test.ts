import { describe, expect, it } from 'vitest'

import { NEUTRAL_ACCOUNT_MESSAGE } from '@/modules/accounts/application/dtos/account-messages/index.js'

import { RequestPasswordRecoveryUseCase } from './index.js'

describe('RequestPasswordRecoveryUseCase', () => {
  it('requests recovery and returns a neutral response', async () => {
    const emails: string[] = []
    const useCase = new RequestPasswordRecoveryUseCase({
      authIdentityProvider: {
        requestPasswordRecovery: (params) => {
          emails.push(params.email)
          return Promise.resolve()
        },
      },
    })

    await expect(
      useCase.execute({ email: ' Person@Example.com ', captchaToken: 'captcha-token' }),
    ).resolves.toEqual({ message: NEUTRAL_ACCOUNT_MESSAGE })
    expect(emails).toEqual(['person@example.com'])
  })
})
