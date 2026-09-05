import { AccountNotFoundError } from '@/modules/accounts/domain/errors/account-not-found-error/index.js'
import type { AccessTokenValidator } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { UnitOfWork } from '@/modules/accounts/domain/ports/unit-of-work/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { DisplayName } from '@/modules/accounts/domain/value-objects/display-name/index.js'

import type { UpdateAccountNameInput, UpdateAccountNameOutput } from './types.js'

export interface UpdateAccountNameDependencies {
  readonly accounts: AccountsRepository
  readonly authIdentityProvider: AccessTokenValidator
  readonly unitOfWork: UnitOfWork
}

export class UpdateAccountNameUseCase {
  constructor(private readonly dependencies: UpdateAccountNameDependencies) {}

  async execute(input: UpdateAccountNameInput): Promise<UpdateAccountNameOutput> {
    const identity =
      input.identity ??
      (input.accessToken === undefined
        ? null
        : await this.dependencies.authIdentityProvider.validateAccessToken(input.accessToken))
    if (identity === null) throw new AccountNotFoundError()
    const name = DisplayName.create(input.name)

    return this.dependencies.unitOfWork.run(async () => {
      const account = await this.dependencies.accounts.findByAuthUserId(identity.authUserId)
      if (account === null) throw new AccountNotFoundError()

      account.changeName(name)
      await this.dependencies.accounts.save(account)

      return { name: name.value }
    })
  }
}
