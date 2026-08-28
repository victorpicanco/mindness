import type { EmailOtpVerifier } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { UnitOfWork } from '@/modules/accounts/domain/ports/unit-of-work/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'

import type { ConfirmEmailInput, ConfirmEmailOutput } from './types.js'

export interface ConfirmEmailDependencies {
  readonly accounts: AccountsRepository
  readonly authIdentityProvider: EmailOtpVerifier
  readonly unitOfWork: UnitOfWork
}

export class ConfirmEmailUseCase {
  constructor(private readonly dependencies: ConfirmEmailDependencies) {}

  async execute(input: ConfirmEmailInput): Promise<ConfirmEmailOutput> {
    const session = await this.dependencies.authIdentityProvider.verifyEmailOtp(
      input.tokenHash,
      input.type,
    )

    await this.dependencies.unitOfWork.run(async () => {
      const account = await this.dependencies.accounts.findByAuthUserId(session.identity.authUserId)
      if (account === null) return

      account.startSession(session.identity.sessionId)
      await this.dependencies.accounts.save(account)
    })

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.toISOString(),
    }
  }
}
