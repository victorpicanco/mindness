import { describe, expect, it } from 'vitest'

import { QuotaReservation } from '@/modules/quota/domain/entities/quota-reservation/index.js'
import type { QuotaReservationRow } from '@/modules/quota/infrastructure/clients/quota-prisma-client/index.js'

import { QuotaReservationMapper } from './index.js'

const heldRow: QuotaReservationRow = {
  id: '6f3a143d-6853-48f0-b414-a57d8b65f101',
  accountId: '97784f56-9b46-44a4-a0d2-52e97d2fe201',
  cycleId: 'caf10e0d-969b-4f05-9a4a-9d487e7a1301',
  sessionId: 'session-1',
  status: 'held',
  createdAt: new Date('2026-08-17T12:00:00.000Z'),
  resolvedAt: null,
}

const consumedPaidPlanRow: QuotaReservationRow = {
  ...heldRow,
  cycleId: null,
  status: 'consumed',
  resolvedAt: new Date('2026-08-17T12:05:00.000Z'),
}

describe('QuotaReservationMapper', () => {
  it.each([
    ['a held reservation', heldRow],
    ['a consumed reservation without a cycle', consumedPaidPlanRow],
  ])('maps %s back and forth without losing state', (_label, row) => {
    const mapper = new QuotaReservationMapper()

    expect(mapper.toDomain(row)).toBeInstanceOf(QuotaReservation)
    expect(mapper.toPersistence(mapper.toDomain(row))).toEqual(row)
  })
})
