import { AccountDeletionRequest } from '@/modules/accounts/domain/entities/account-deletion-request/index.js'
import { AccountNotFoundError } from '@/modules/accounts/domain/errors/account-not-found-error/index.js'
import { ReauthenticationRequiredError } from '@/modules/accounts/domain/errors/reauthentication-required-error/index.js'
import { AccountDeletionRequested } from '@/modules/accounts/domain/events/account-deletion-requested/index.js'
import type {
  AccessTokenValidator,
  SessionRevoker,
} from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { Clock } from '@/modules/accounts/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/accounts/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/accounts/domain/ports/id-generator/index.js'
import type { SubscriptionCancellation } from '@/modules/accounts/domain/ports/subscription-cancellation/index.js'
import type { UnitOfWork } from '@/modules/accounts/domain/ports/unit-of-work/index.js'
import type { AccountDeletionRequestsRepository } from '@/modules/accounts/domain/repositories/account-deletion-requests-repository/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'

import type { DeleteAccountInput, DeleteAccountOutput } from './types.js'

export interface DeleteAccountDependencies {
  readonly accounts: AccountsRepository
  readonly authIdentityProvider: AccessTokenValidator & SessionRevoker
  readonly clock: Clock
  readonly deletionRequests: AccountDeletionRequestsRepository
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly subscriptionCancellation: SubscriptionCancellation
  readonly unitOfWork: UnitOfWork
}

export class DeleteAccountUseCase {
  constructor(private readonly dependencies: DeleteAccountDependencies) {}

  async execute(input: DeleteAccountInput): Promise<DeleteAccountOutput> {
    const identity = await this.dependencies.authIdentityProvider.validateAccessToken(
      input.accessToken,
    )
    const requestedAt = this.dependencies.clock.now()
    const authenticationAge = requestedAt.getTime() - identity.issuedAt.getTime()
    if (authenticationAge > 5 * 60 * 1000) throw new ReauthenticationRequiredError()

    const scheduledFor = new Date(requestedAt.getTime() + 30 * 24 * 60 * 60 * 1000)

    await this.dependencies.unitOfWork.run(async () => {
      const account = await this.dependencies.accounts.findByAuthUserId(identity.authUserId)
      if (account === null || account.status !== 'accessible') throw new AccountNotFoundError()

      await this.dependencies.subscriptionCancellation.cancelActiveSubscription(account.id)
      account.scheduleDeletion()
      const deletionRequest = AccountDeletionRequest.create({
        id: this.dependencies.idGenerator.generate(),
        accountId: account.id,
        requestedAt,
        scheduledFor,
      })

      await this.dependencies.accounts.save(account)
      await this.dependencies.deletionRequests.save(deletionRequest)
      await this.dependencies.eventPublisher.publish(
        AccountDeletionRequested.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: requestedAt,
          accountId: account.id,
          plan: account.plan,
          scheduledFor: scheduledFor.toISOString(),
        }),
      )
    })

    await this.dependencies.authIdentityProvider.revokeSession(input.accessToken)

    return { scheduledFor: scheduledFor.toISOString() }
  }
}
