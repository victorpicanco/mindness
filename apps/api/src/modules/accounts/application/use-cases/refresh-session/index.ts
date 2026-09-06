import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type { RefreshTokenAuthenticator } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'

import type { RefreshSessionInput, RefreshSessionOutput } from './types.js'

export interface RefreshSessionDependencies {
  readonly accounts: AccountsRepository
  readonly authIdentityProvider: RefreshTokenAuthenticator
}

export class RefreshSessionUseCase {
  constructor(private readonly dependencies: RefreshSessionDependencies) {}

  async execute(input: RefreshSessionInput): Promise<RefreshSessionOutput> {
    const session = await this.dependencies.authIdentityProvider.refreshSession(input.refreshToken)
    const account = await this.dependencies.accounts.findByAuthUserId(session.identity.authUserId)
    const sessionWasReplaced =
      account !== null && !account.canAuthenticate(session.identity.sessionId)
    if (sessionWasReplaced) throw new AuthenticationRejectedError('invalid_token')

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.toISOString(),
    }
  }
}
