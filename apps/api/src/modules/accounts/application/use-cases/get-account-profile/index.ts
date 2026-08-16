import { AccountNotFoundError } from '@/modules/accounts/domain/errors/account-not-found-error/index.js'
import type { AccessTokenValidator } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'

import type { GetAccountProfileInput, GetAccountProfileOutput } from './types.js'

export interface GetAccountProfileDependencies {
  readonly accounts: AccountsRepository
  readonly authIdentityProvider: AccessTokenValidator
}

export class GetAccountProfileUseCase {
  constructor(private readonly dependencies: GetAccountProfileDependencies) {}

  async execute(input: GetAccountProfileInput): Promise<GetAccountProfileOutput> {
    const identity =
      input.identity ??
      (input.accessToken === undefined
        ? null
        : await this.dependencies.authIdentityProvider.validateAccessToken(input.accessToken))
    if (identity === null) throw new AccountNotFoundError()
    const account = await this.dependencies.accounts.findByAuthUserId(identity.authUserId)
    if (account === null || account.status !== 'accessible') throw new AccountNotFoundError()

    const consent = account.voiceConsent

    return {
      accountId: account.id,
      email: account.email.value,
      timeZone: account.timeZone.value,
      plan: account.plan,
      consent:
        consent === null
          ? null
          : {
              purpose: consent.purpose,
              version: consent.version,
              acceptedAt: consent.acceptedAt.toISOString(),
            },
    }
  }
}
