import { describe, expect, it } from 'vitest'

import { NEUTRAL_ACCOUNT_MESSAGE } from '@/modules/accounts/application/dtos/account-messages/index.js'

import { ResendSignUpConfirmationUseCase } from './index.js'

describe('ResendSignUpConfirmationUseCase', () => {
  it('normalizes the email and returns a neutral response', async () => {
    const emails: string[] = []
    const useCase = new ResendSignUpConfirmationUseCase({
      authIdentityProvider: {
        resendSignUpConfirmation: (params) => {
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
