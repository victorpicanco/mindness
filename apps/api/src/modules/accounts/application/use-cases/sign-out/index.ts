import type { SessionRevoker } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

import type { SignOutInput, SignOutOutput } from './types.js'

export class SignOutUseCase {
  constructor(private readonly dependencies: { readonly authIdentityProvider: SessionRevoker }) {}

  async execute(input: SignOutInput): Promise<SignOutOutput> {
    await this.dependencies.authIdentityProvider.revokeSession(input.accessToken)
    return { message: 'Session ended' }
  }
}
