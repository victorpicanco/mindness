import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import { GoogleLoginRejected } from '@/modules/accounts/domain/events/google-login-rejected/index.js'
import type {
  AuthSession,
  GoogleAuthenticator,
} from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { Clock } from '@/modules/accounts/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/accounts/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/accounts/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/accounts/domain/ports/unit-of-work/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'

import type { CompleteGoogleSignInInput, CompleteGoogleSignInOutput } from './types.js'

export interface CompleteGoogleSignInDependencies {
  readonly accounts: AccountsRepository
  readonly authIdentityProvider: Pick<GoogleAuthenticator, 'exchangeGoogleCode'>
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly unitOfWork: UnitOfWork
}

export class CompleteGoogleSignInUseCase {
  constructor(private readonly dependencies: CompleteGoogleSignInDependencies) {}

  async execute(input: CompleteGoogleSignInInput): Promise<CompleteGoogleSignInOutput> {
    const session = await this.exchange(input)

    await this.dependencies.unitOfWork.run(async () => {
      const account = await this.dependencies.accounts.findByAuthUserId(session.identity.authUserId)
      if (account === null) return

      account.startSession(session.identity.sessionId)
      await this.dependencies.accounts.save(account)
    })

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.toISOString(),
    }
  }

  private async exchange(input: CompleteGoogleSignInInput): Promise<AuthSession> {
    try {
      return await this.dependencies.authIdentityProvider.exchangeGoogleCode(
        input.code,
        input.pkceState,
      )
    } catch (error) {
      if (!(error instanceof AuthenticationRejectedError)) throw error

      await this.dependencies.eventPublisher.publish(
        GoogleLoginRejected.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: this.dependencies.clock.now(),
          accountId: null,
          plan: null,
          reason: error.reason,
        }),
      )
      throw error
    }
  }
}
