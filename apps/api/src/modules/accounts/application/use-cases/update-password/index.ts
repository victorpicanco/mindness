import type {
  PasswordUpdater,
  SessionRevoker,
} from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import { Password } from '@/modules/accounts/domain/value-objects/password/index.js'

import type { UpdatePasswordInput, UpdatePasswordOutput } from './types.js'

export class UpdatePasswordUseCase {
  constructor(
    private readonly dependencies: {
      readonly authIdentityProvider: PasswordUpdater & SessionRevoker
    },
  ) {}

  async execute(input: UpdatePasswordInput): Promise<UpdatePasswordOutput> {
    const password = Password.create(input.password)
    await this.dependencies.authIdentityProvider.updatePassword(input.authUserId, password.value)
    await this.dependencies.authIdentityProvider.revokeSession(input.accessToken)
    return { message: 'Password updated' }
  }
}
