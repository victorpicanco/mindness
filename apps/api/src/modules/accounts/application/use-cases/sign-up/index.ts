import { NEUTRAL_ACCOUNT_MESSAGE } from '@/modules/accounts/application/dtos/account-messages/index.js'
import type { IdentityRegistrar } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { Password } from '@/modules/accounts/domain/value-objects/password/index.js'

import type { SignUpInput, SignUpOutput } from './types.js'

export interface SignUpDependencies {
  readonly authIdentityProvider: IdentityRegistrar
}

export class SignUpUseCase {
  constructor(private readonly dependencies: SignUpDependencies) {}

  async execute(input: SignUpInput): Promise<SignUpOutput> {
    const email = EmailAddress.create(input.email)
    const password = Password.create(input.password)

    await this.dependencies.authIdentityProvider.signUpWithPassword({
      email: email.value,
      password: password.value,
      captchaToken: input.captchaToken,
    })

    return { message: NEUTRAL_ACCOUNT_MESSAGE }
  }
}
