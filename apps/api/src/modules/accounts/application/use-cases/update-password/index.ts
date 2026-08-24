import type { PasswordUpdater } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import { Password } from '@/modules/accounts/domain/value-objects/password/index.js'

import type { UpdatePasswordInput, UpdatePasswordOutput } from './types.js'

export class UpdatePasswordUseCase {
  constructor(
    private readonly dependencies: {
      readonly authIdentityProvider: PasswordUpdater
    },
  ) {}

  async execute(input: UpdatePasswordInput): Promise<UpdatePasswordOutput> {
    const password = Password.create(input.password)
    await this.dependencies.authIdentityProvider.updatePassword(input.authUserId, password.value)
    return { message: 'Password updated' }
  }
}
