import { describe, expect, it } from 'vitest'

import { InvalidQuotaTransitionError } from '@/modules/quota/domain/errors/invalid-quota-transition-error/index.js'

import { QuotaReservation } from './index.js'

const CREATED_AT = new Date('2026-08-17T12:00:00.000Z')
const RESOLVED_AT = new Date('2026-08-17T12:05:00.000Z')

function createReservation(cycleId: string | null = 'cycle-1'): QuotaReservation {
  return QuotaReservation.create({
    id: 'reservation-1',
    accountId: 'account-1',
    cycleId,
    sessionId: 'session-1',
    createdAt: CREATED_AT,
  })
}

describe('QuotaReservation', () => {
  it('creates a held reservation without a resolution instant', () => {
    const reservation = createReservation()

    expect(reservation.status).toBe('held')
    expect(reservation.resolvedAt).toBeNull()
  })

  it('consumes a held reservation', () => {
    const reservation = createReservation()

    reservation.consume(RESOLVED_AT)

    expect(reservation.status).toBe('consumed')
    expect(reservation.resolvedAt).toEqual(RESOLVED_AT)
  })

  it('releases a held reservation', () => {
    const reservation = createReservation()

    reservation.release(RESOLVED_AT)

    expect(reservation.status).toBe('released')
    expect(reservation.resolvedAt).toEqual(RESOLVED_AT)
  })

  it('rejects invalid transitions', () => {
    const releasedReservation = createReservation()
    releasedReservation.release(RESOLVED_AT)
    const consumedReservation = createReservation()
    consumedReservation.consume(RESOLVED_AT)

    expect(() => releasedReservation.consume(RESOLVED_AT)).toThrow(InvalidQuotaTransitionError)
    expect(() => consumedReservation.release(RESOLVED_AT)).toThrow(InvalidQuotaTransitionError)
  })

  it('keeps same-state transitions idempotent', () => {
    const consumedReservation = createReservation()
    consumedReservation.consume(RESOLVED_AT)
    const releasedReservation = createReservation()
    releasedReservation.release(RESOLVED_AT)

    consumedReservation.consume(new Date('2026-08-17T12:10:00.000Z'))
    releasedReservation.release(new Date('2026-08-17T12:10:00.000Z'))

    expect(consumedReservation.resolvedAt).toEqual(RESOLVED_AT)
    expect(releasedReservation.resolvedAt).toEqual(RESOLVED_AT)
  })

  it('allows paid-plan reservations without a cycle', () => {
    expect(createReservation(null).cycleId).toBeNull()
  })

  it('counts held and consumed reservations against the balance', () => {
    const heldReservation = createReservation()
    const consumedReservation = createReservation()
    consumedReservation.consume(RESOLVED_AT)
    const releasedReservation = createReservation()
    releasedReservation.release(RESOLVED_AT)

    expect(heldReservation.countsAgainstBalance()).toBe(true)
    expect(consumedReservation.countsAgainstBalance()).toBe(true)
    expect(releasedReservation.countsAgainstBalance()).toBe(false)
  })
})
