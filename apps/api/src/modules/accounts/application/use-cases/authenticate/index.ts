import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type { AccessTokenValidator } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'

import type { AuthenticateInput, AuthenticateOutput } from './types.js'

export interface AuthenticateDependencies {
  readonly accounts: AccountsRepository
  readonly authIdentityProvider: AccessTokenValidator
}

export class AuthenticateUseCase {
  constructor(private readonly dependencies: AuthenticateDependencies) {}

  async execute(input: AuthenticateInput): Promise<AuthenticateOutput> {
    const identity = await this.dependencies.authIdentityProvider.validateAccessToken(
      input.accessToken,
    )
    const account = await this.dependencies.accounts.findByAuthUserId(identity.authUserId)

    const sessionWasReplaced = account !== null && !account.canAuthenticate(identity.sessionId)
    if (sessionWasReplaced) throw new AuthenticationRejectedError('invalid_token')

    return {
      accountId: account?.id ?? null,
      authUserId: identity.authUserId,
      email: identity.email,
      sessionId: identity.sessionId,
      issuedAt: identity.issuedAt,
      authenticationMethod: identity.authenticationMethod,
    }
  }
}
