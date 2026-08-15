import { AccountNotFoundError } from '@/modules/accounts/domain/errors/account-not-found-error/index.js'
import { ConsentAccepted } from '@/modules/accounts/domain/events/consent-accepted/index.js'
import type { AccessTokenValidator } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { Clock } from '@/modules/accounts/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/accounts/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/accounts/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/accounts/domain/ports/unit-of-work/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { VoiceConsent } from '@/modules/accounts/domain/value-objects/voice-consent/index.js'

import type { AcceptConsentInput, AcceptConsentOutput } from './types.js'

export interface AcceptConsentDependencies {
  readonly accounts: AccountsRepository
  readonly authIdentityProvider: AccessTokenValidator
  readonly clock: Clock
  readonly consentVersion: string
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly unitOfWork: UnitOfWork
}

export class AcceptConsentUseCase {
  constructor(private readonly dependencies: AcceptConsentDependencies) {}

  async execute(input: AcceptConsentInput): Promise<AcceptConsentOutput> {
    const identity = await this.dependencies.authIdentityProvider.validateAccessToken(
      input.accessToken,
    )

    return this.dependencies.unitOfWork.run(async () => {
      const account = await this.dependencies.accounts.findByAuthUserId(identity.authUserId)
      if (account === null) throw new AccountNotFoundError()

      const requestedConsent = VoiceConsent.create({
        version: this.dependencies.consentVersion,
        acceptedAt: this.dependencies.clock.now(),
      })
      const { changed, consent } = account.acceptVoiceConsent(requestedConsent)
      if (!changed) {
        return {
          acceptedAt: consent.acceptedAt.toISOString(),
          purpose: consent.purpose,
          version: consent.version,
        }
      }

      await this.dependencies.accounts.save(account)
      await this.dependencies.eventPublisher.publish(
        ConsentAccepted.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: this.dependencies.clock.now(),
          accountId: account.id,
          plan: account.plan,
          purpose: consent.purpose,
          version: consent.version,
        }),
      )

      return {
        acceptedAt: consent.acceptedAt.toISOString(),
        purpose: consent.purpose,
        version: consent.version,
      }
    })
  }
}
