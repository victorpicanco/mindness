import { NEUTRAL_ACCOUNT_MESSAGE } from '@/modules/accounts/application/dtos/account-messages/index.js'
import type { ConfirmationResender } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'

import type { ResendSignUpConfirmationInput, ResendSignUpConfirmationOutput } from './types.js'

export class ResendSignUpConfirmationUseCase {
  constructor(
    private readonly dependencies: { readonly authIdentityProvider: ConfirmationResender },
  ) {}

  async execute(input: ResendSignUpConfirmationInput): Promise<ResendSignUpConfirmationOutput> {
    const email = EmailAddress.create(input.email.trim())
    await this.dependencies.authIdentityProvider.resendSignUpConfirmation({
      email: email.value,
      captchaToken: input.captchaToken,
    })
    return { message: NEUTRAL_ACCOUNT_MESSAGE }
  }
}
