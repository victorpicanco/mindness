import type { GoogleAuthenticator } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

import type { StartGoogleSignInOutput } from './types.js'

export interface StartGoogleSignInDependencies {
  readonly authIdentityProvider: Pick<GoogleAuthenticator, 'createGoogleAuthorization'>
  readonly googleCallbackUrl: string
}

export class StartGoogleSignInUseCase {
  constructor(private readonly dependencies: StartGoogleSignInDependencies) {}

  async execute(): Promise<StartGoogleSignInOutput> {
    const authorization = await this.dependencies.authIdentityProvider.createGoogleAuthorization(
      this.dependencies.googleCallbackUrl,
    )

    return {
      authorizationUrl: authorization.authorizationUrl,
      pkceState: authorization.pkceState,
    }
  }
}
