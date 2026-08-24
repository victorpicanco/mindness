import type { EmailOtpVerifier } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

import type { ConfirmEmailInput, ConfirmEmailOutput } from './types.js'

export class ConfirmEmailUseCase {
  constructor(private readonly dependencies: { readonly authIdentityProvider: EmailOtpVerifier }) {}

  async execute(input: ConfirmEmailInput): Promise<ConfirmEmailOutput> {
    const session = await this.dependencies.authIdentityProvider.verifyEmailOtp(
      input.tokenHash,
      input.type,
    )

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.toISOString(),
    }
  }
}
