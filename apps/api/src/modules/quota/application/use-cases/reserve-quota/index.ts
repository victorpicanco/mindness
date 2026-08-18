import { QuotaCycle } from '@/modules/quota/domain/entities/quota-cycle/index.js'
import { QuotaReservation } from '@/modules/quota/domain/entities/quota-reservation/index.js'
import { QuotaAccountNotFoundError } from '@/modules/quota/domain/errors/quota-account-not-found-error/index.js'
import { QuotaExhaustedError } from '@/modules/quota/domain/errors/quota-exhausted-error/index.js'
import { QuotaExhausted } from '@/modules/quota/domain/events/quota-exhausted/index.js'
import { QuotaPolicy } from '@/modules/quota/domain/services/quota-policy/index.js'
import { CycleWindow } from '@/modules/quota/domain/value-objects/cycle-window/index.js'

import type { ReserveQuotaDependencies, ReserveQuotaInput, ReserveQuotaOutput } from './types.js'

type ReservationDecision =
  { readonly granted: ReserveQuotaOutput } | { readonly exhausted: { readonly renewsAt: Date } }

export class ReserveQuotaUseCase {
  constructor(private readonly dependencies: ReserveQuotaDependencies) {}

  async execute(input: ReserveQuotaInput): Promise<ReserveQuotaOutput> {
    const account = await this.dependencies.accounts.findAccount(input.accountId)

    if (account === null) throw new QuotaAccountNotFoundError(input.accountId)

    const decision = await this.dependencies.unitOfWork.run(
      async (): Promise<ReservationDecision> => {
        const now = this.dependencies.clock.now()
        const existingReservation = await this.dependencies.quotaReservations.findBySessionId(
          input.sessionId,
        )

        if (existingReservation !== null) {
          return this.existingDecision(existingReservation, account.plan)
        }

        if (!QuotaPolicy.isEnforced(account.plan)) {
          return { granted: await this.reservePaidAccount(input.accountId, input.sessionId, now) }
        }

        const currentCycle = await this.dependencies.quotaCycles.findCurrent(account.accountId, now)
        const cycle =
          currentCycle ?? (await this.openCycle(account.accountId, account.createdAt, now))
        const counts = await this.dependencies.quotaReservations.countByCycle(cycle.id)

        if (cycle.isExhaustedFor(counts)) return { exhausted: { renewsAt: cycle.window.renewsAt } }

        const reservation = QuotaReservation.create({
          id: this.dependencies.idGenerator.generate(),
          accountId: input.accountId,
          cycleId: cycle.id,
          sessionId: input.sessionId,
          createdAt: now,
        })
        await this.dependencies.quotaReservations.save(reservation)

        return {
          granted: {
            reservationId: reservation.id,
            enforced: true,
            remaining: cycle.remainingFor({ held: counts.held + 1, consumed: counts.consumed }),
          },
        }
      },
    )

    if ('granted' in decision) return decision.granted

    const occurredAt = this.dependencies.clock.now()
    await this.dependencies.eventPublisher.publish(
      QuotaExhausted.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt,
        accountId: input.accountId,
        plan: account.plan,
        renewsAt: decision.exhausted.renewsAt,
      }),
    )
    throw new QuotaExhaustedError(input.accountId, decision.exhausted.renewsAt)
  }

  private async existingDecision(
    reservation: QuotaReservation,
    plan: 'free' | 'plus',
  ): Promise<ReservationDecision> {
    if (!QuotaPolicy.isEnforced(plan) || reservation.cycleId === null) {
      return { granted: { reservationId: reservation.id, enforced: false } }
    }

    const cycle = await this.dependencies.quotaCycles.findLatest(reservation.accountId)
    if (cycle === null)
      return { granted: { reservationId: reservation.id, enforced: true, remaining: 0 } }
    const counts = await this.dependencies.quotaReservations.countByCycle(cycle.id)

    return {
      granted: {
        reservationId: reservation.id,
        enforced: true,
        remaining: cycle.remainingFor(counts),
      },
    }
  }

  private async reservePaidAccount(
    accountId: string,
    sessionId: string,
    now: Date,
  ): Promise<ReserveQuotaOutput> {
    const reservation = QuotaReservation.create({
      id: this.dependencies.idGenerator.generate(),
      accountId,
      cycleId: null,
      sessionId,
      createdAt: now,
    })
    await this.dependencies.quotaReservations.save(reservation)

    return { reservationId: reservation.id, enforced: false }
  }

  private async openCycle(accountId: string, createdAt: Date, now: Date): Promise<QuotaCycle> {
    const latestCycle = await this.dependencies.quotaCycles.findLatest(accountId)
    const window =
      latestCycle === null
        ? CycleWindow.create(createdAt).advanceTo(now)
        : latestCycle.window.advanceTo(now)
    const cycle = QuotaCycle.create({
      id: this.dependencies.idGenerator.generate(),
      accountId,
      sequence: (latestCycle?.sequence ?? 0) + 1,
      window,
      allowance: QuotaPolicy.allowanceFor('free'),
      carriedUsage: 0,
      createdAt: now,
    })
    await this.dependencies.quotaCycles.save(cycle)

    return cycle
  }
}

export type { ReserveQuotaDependencies, ReserveQuotaInput, ReserveQuotaOutput } from './types.js'
