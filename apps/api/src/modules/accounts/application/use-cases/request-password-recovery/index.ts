import { NEUTRAL_ACCOUNT_MESSAGE } from '@/modules/accounts/application/dtos/account-messages/index.js'
import type { PasswordRecoveryRequester } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'

import type { RequestPasswordRecoveryInput, RequestPasswordRecoveryOutput } from './types.js'

export class RequestPasswordRecoveryUseCase {
  constructor(
    private readonly dependencies: { readonly authIdentityProvider: PasswordRecoveryRequester },
  ) {}

  async execute(input: RequestPasswordRecoveryInput): Promise<RequestPasswordRecoveryOutput> {
    const email = EmailAddress.create(input.email.trim())
    await this.dependencies.authIdentityProvider.requestPasswordRecovery({
      email: email.value,
      captchaToken: input.captchaToken,
    })
    return { message: NEUTRAL_ACCOUNT_MESSAGE }
  }
}
