import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { AccountCreated } from '@/modules/accounts/domain/events/account-created/index.js'
import { AccountCreationRejected } from '@/modules/accounts/domain/events/account-creation-rejected/index.js'
import { BetaCapacityReached } from '@/modules/accounts/domain/events/beta-capacity-reached/index.js'
import { BetaCapacityReachedError } from '@/modules/accounts/domain/errors/beta-capacity-reached-error/index.js'
import type { AccessTokenValidator } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { Clock } from '@/modules/accounts/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/accounts/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/accounts/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/accounts/domain/ports/unit-of-work/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import { BetaCapacity } from '@/modules/accounts/domain/value-objects/beta-capacity/index.js'

import type { CreateAccountInput, CreateAccountOutput } from './types.js'

export interface CreateAccountDependencies {
  readonly accounts: AccountsRepository
  readonly authIdentityProvider: AccessTokenValidator
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly unitOfWork: UnitOfWork
}

export class CreateAccountUseCase {
  constructor(private readonly dependencies: CreateAccountDependencies) {}

  async execute(input: CreateAccountInput): Promise<CreateAccountOutput> {
    const identity = await this.dependencies.authIdentityProvider.validateAccessToken(
      input.accessToken,
    )

    await this.dependencies.unitOfWork.run(async () => {
      const existingByIdentity = await this.dependencies.accounts.findByAuthUserId(
        identity.authUserId,
      )
      const existing =
        existingByIdentity ?? (await this.dependencies.accounts.findByEmail(identity.email))

      if (existing !== null) {
        await this.dependencies.eventPublisher.publish(
          AccountCreationRejected.create({
            eventId: this.dependencies.idGenerator.generate(),
            occurredAt: this.dependencies.clock.now(),
            accountId: existing.id,
            plan: existing.plan,
          }),
        )
        return
      }

      const accountCount = await this.dependencies.accounts.count()

      try {
        BetaCapacity.ensureAvailable(accountCount)
      } catch (error) {
        if (!(error instanceof BetaCapacityReachedError)) throw error

        await this.dependencies.eventPublisher.publish(
          BetaCapacityReached.create({
            eventId: this.dependencies.idGenerator.generate(),
            occurredAt: this.dependencies.clock.now(),
            plan: 'free',
            capacity: 100,
          }),
        )
        throw error
      }

      const account = Account.create({
        id: this.dependencies.idGenerator.generate(),
        email: EmailAddress.create(identity.email),
        authUserId: identity.authUserId,
        timeZone: TimeZone.fromOptional(input.timeZone ?? undefined),
        createdAt: this.dependencies.clock.now(),
      })

      await this.dependencies.accounts.save(account)
      await this.dependencies.eventPublisher.publish(
        AccountCreated.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: this.dependencies.clock.now(),
          accountId: account.id,
          plan: account.plan,
        }),
      )
    })

    return {
      message:
        'Verifique seu e-mail para continuar, caso exista uma conta elegível para este endereço.',
    }
  }
}
