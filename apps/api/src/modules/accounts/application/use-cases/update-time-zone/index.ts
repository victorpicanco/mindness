import { AccountNotFoundError } from '@/modules/accounts/domain/errors/account-not-found-error/index.js'
import type { AccessTokenValidator } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { UnitOfWork } from '@/modules/accounts/domain/ports/unit-of-work/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'

import type { UpdateTimeZoneInput, UpdateTimeZoneOutput } from './types.js'

export interface UpdateTimeZoneDependencies {
  readonly accounts: AccountsRepository
  readonly authIdentityProvider: AccessTokenValidator
  readonly unitOfWork: UnitOfWork
}

export class UpdateTimeZoneUseCase {
  constructor(private readonly dependencies: UpdateTimeZoneDependencies) {}

  async execute(input: UpdateTimeZoneInput): Promise<UpdateTimeZoneOutput> {
    const identity =
      input.identity ??
      (input.accessToken === undefined
        ? null
        : await this.dependencies.authIdentityProvider.validateAccessToken(input.accessToken))
    if (identity === null) throw new AccountNotFoundError()
    const timeZone = TimeZone.create(input.timeZone)

    return this.dependencies.unitOfWork.run(async () => {
      const account = await this.dependencies.accounts.findByAuthUserId(identity.authUserId)
      if (account === null) throw new AccountNotFoundError()

      account.changeTimeZone(timeZone)
      await this.dependencies.accounts.save(account)

      return { timeZone: account.timeZone.value }
    })
  }
}
