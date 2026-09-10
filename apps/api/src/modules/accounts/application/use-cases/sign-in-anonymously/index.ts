import type { AnonymousAuthenticator } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

import type { SignInAnonymouslyInput, SignInAnonymouslyOutput } from './types.js'

export interface SignInAnonymouslyDependencies {
  readonly authIdentityProvider: AnonymousAuthenticator
}

export class SignInAnonymouslyUseCase {
  constructor(private readonly dependencies: SignInAnonymouslyDependencies) {}

  async execute(input: SignInAnonymouslyInput): Promise<SignInAnonymouslyOutput> {
    const session = await this.dependencies.authIdentityProvider.signInAnonymously({
      captchaToken: input.captchaToken,
    })

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.toISOString(),
    }
  }
}

export type { SignInAnonymouslyInput, SignInAnonymouslyOutput } from './types.js'
