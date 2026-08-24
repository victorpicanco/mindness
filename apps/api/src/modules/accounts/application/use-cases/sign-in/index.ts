import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type { AuthenticationRejectionReason } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import { EmailNotConfirmedError } from '@/modules/accounts/domain/errors/email-not-confirmed-error/index.js'
import { LoginRejected } from '@/modules/accounts/domain/events/login-rejected/index.js'
import type { AuthSession } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { PasswordAuthenticator } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { Clock } from '@/modules/accounts/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/accounts/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/accounts/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/accounts/domain/ports/unit-of-work/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'

import type { SignInInput, SignInOutput } from './types.js'

function rejectionReasonOf(error: unknown): AuthenticationRejectionReason | null {
  if (error instanceof AuthenticationRejectedError) return error.reason
  if (error instanceof EmailNotConfirmedError) return error.reason

  return null
}

export interface SignInDependencies {
  readonly accounts: AccountsRepository
  readonly authIdentityProvider: PasswordAuthenticator
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly unitOfWork: UnitOfWork
}

export class SignInUseCase {
  constructor(private readonly dependencies: SignInDependencies) {}

  async execute(input: SignInInput): Promise<SignInOutput> {
    const email = EmailAddress.create(input.email)
    const session = await this.authenticate(email, input)

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

  private async authenticate(email: EmailAddress, input: SignInInput): Promise<AuthSession> {
    try {
      return await this.dependencies.authIdentityProvider.signInWithPassword({
        email: email.value,
        password: input.password,
        captchaToken: input.captchaToken,
      })
    } catch (error) {
      const reason = rejectionReasonOf(error)
      if (reason === null) throw error

      await this.publishRejection(email, reason)
      throw error
    }
  }

  private async publishRejection(
    email: EmailAddress,
    reason: AuthenticationRejectionReason,
  ): Promise<void> {
    const account = await this.dependencies.accounts.findByEmail(email.value)

    await this.dependencies.eventPublisher.publish(
      LoginRejected.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt: this.dependencies.clock.now(),
        accountId: account?.id ?? null,
        plan: account?.plan ?? null,
        reason,
      }),
    )
  }
}
