import { describe, expect, it } from 'vitest'

import { QuotaReservation } from '@/modules/quota/domain/entities/quota-reservation/index.js'
import { InvalidQuotaTransitionError } from '@/modules/quota/domain/errors/invalid-quota-transition-error/index.js'
import { QuotaReservationNotFoundError } from '@/modules/quota/domain/errors/quota-reservation-not-found-error/index.js'
import type { Clock } from '@/modules/quota/domain/ports/clock/index.js'
import type { UnitOfWork } from '@/modules/quota/domain/ports/unit-of-work/index.js'
import type { QuotaReservationsRepository } from '@/modules/quota/domain/repositories/quota-reservations-repository/index.js'

import { ConsumeQuotaReservationUseCase } from './index.js'

const NOW = new Date('2026-08-01T00:00:00.000Z')

function createReservation(cycleId: string | null = 'cycle-1'): QuotaReservation {
  return QuotaReservation.create({
    id: 'reservation-1',
    accountId: 'account-1',
    cycleId,
    sessionId: 'session-1',
    createdAt: NOW,
  })
}

function createHarness(reservation: QuotaReservation | null) {
  const saved: QuotaReservation[] = []
  const clock: Clock = { now: () => NOW }
  const unitOfWork: UnitOfWork = { run: (operation) => operation() }
  const quotaReservations: QuotaReservationsRepository = {
    findBySessionId: () => Promise.resolve(reservation),
    countByCycle: () => Promise.resolve({ held: 0, consumed: 0 }),
    countConsumedSince: () => Promise.resolve(0),
    save: (nextReservation) => {
      saved.push(nextReservation)
      return Promise.resolve()
    },
  }

  return {
    saved,
    useCase: new ConsumeQuotaReservationUseCase({ clock, quotaReservations, unitOfWork }),
  }
}

describe('ConsumeQuotaReservationUseCase', () => {
  it('consumes a held reservation', async () => {
    const reservation = createReservation()
    const harness = createHarness(reservation)

    await expect(harness.useCase.execute({ sessionId: 'session-1' })).resolves.toBeUndefined()

    expect(reservation.status).toBe('consumed')
    expect(reservation.resolvedAt).toEqual(NOW)
    expect(harness.saved).toEqual([reservation])
  })

  it('is idempotent when the reservation is already consumed', async () => {
    const reservation = createReservation()
    reservation.consume(NOW)
    const harness = createHarness(reservation)

    await expect(harness.useCase.execute({ sessionId: 'session-1' })).resolves.toBeUndefined()

    expect(harness.saved).toEqual([])
  })

  it('throws when consuming a released reservation', async () => {
    const reservation = createReservation()
    reservation.release(NOW)
    const harness = createHarness(reservation)

    await expect(harness.useCase.execute({ sessionId: 'session-1' })).rejects.toBeInstanceOf(
      InvalidQuotaTransitionError,
    )
  })

  it('throws when the session has no reservation', async () => {
    const harness = createHarness(null)

    await expect(harness.useCase.execute({ sessionId: 'missing-session' })).rejects.toBeInstanceOf(
      QuotaReservationNotFoundError,
    )
  })

  it('consumes a paid-plan reservation', async () => {
    const reservation = createReservation(null)
    const harness = createHarness(reservation)

    await harness.useCase.execute({ sessionId: 'session-1' })

    expect(reservation.status).toBe('consumed')
    expect(reservation.cycleId).toBeNull()
  })
})
