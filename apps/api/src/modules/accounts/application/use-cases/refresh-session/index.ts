import type { RefreshTokenAuthenticator } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

import type { RefreshSessionInput, RefreshSessionOutput } from './types.js'

export interface RefreshSessionDependencies {
  readonly authIdentityProvider: RefreshTokenAuthenticator
}

export class RefreshSessionUseCase {
  constructor(private readonly dependencies: RefreshSessionDependencies) {}

  async execute(input: RefreshSessionInput): Promise<RefreshSessionOutput> {
    const session = await this.dependencies.authIdentityProvider.refreshSession(input.refreshToken)

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.toISOString(),
    }
  }
}
