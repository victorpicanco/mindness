import { describe, expect, it } from 'vitest'

import { QuotaReservation } from '@/modules/quota/domain/entities/quota-reservation/index.js'
import type { Clock } from '@/modules/quota/domain/ports/clock/index.js'
import type { UnitOfWork } from '@/modules/quota/domain/ports/unit-of-work/index.js'
import type { QuotaReservationsRepository } from '@/modules/quota/domain/repositories/quota-reservations-repository/index.js'

import { ReleaseQuotaReservationUseCase } from './index.js'

const NOW = new Date('2026-08-01T00:00:00.000Z')

function createReservation(): QuotaReservation {
  return QuotaReservation.create({
    id: 'reservation-1',
    accountId: 'account-1',
    cycleId: 'cycle-1',
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
    useCase: new ReleaseQuotaReservationUseCase({ clock, quotaReservations, unitOfWork }),
  }
}

describe('ReleaseQuotaReservationUseCase', () => {
  it('releases a held reservation back to its current cycle', async () => {
    const reservation = createReservation()
    const harness = createHarness(reservation)

    await expect(harness.useCase.execute({ sessionId: 'session-1' })).resolves.toBeUndefined()

    expect(reservation.status).toBe('released')
    expect(harness.saved).toEqual([reservation])
  })

  it('is a no-op when the reservation was already released', async () => {
    const reservation = createReservation()
    reservation.release(NOW)
    const harness = createHarness(reservation)

    await expect(harness.useCase.execute({ sessionId: 'session-1' })).resolves.toBeUndefined()

    expect(harness.saved).toEqual([])
  })

  it('is a no-op for an unknown session', async () => {
    const harness = createHarness(null)

    await expect(harness.useCase.execute({ sessionId: 'missing-session' })).resolves.toBeUndefined()

    expect(harness.saved).toEqual([])
  })

  it('does not release a consumed reservation', async () => {
    const reservation = createReservation()
    reservation.consume(NOW)
    const harness = createHarness(reservation)

    await expect(harness.useCase.execute({ sessionId: 'session-1' })).resolves.toBeUndefined()

    expect(reservation.status).toBe('consumed')
    expect(harness.saved).toEqual([])
  })
})
