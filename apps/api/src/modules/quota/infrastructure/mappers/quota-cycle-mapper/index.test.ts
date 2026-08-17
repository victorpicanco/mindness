import { describe, expect, it } from 'vitest'

import { QuotaCycle } from '@/modules/quota/domain/entities/quota-cycle/index.js'
import type { QuotaCycleRow } from '@/modules/quota/infrastructure/clients/quota-prisma-client/index.js'

import { QuotaCycleMapper } from './index.js'

const row: QuotaCycleRow = {
  id: '6f3a143d-6853-48f0-b414-a57d8b65f101',
  accountId: '97784f56-9b46-44a4-a0d2-52e97d2fe201',
  sequence: 3,
  startsAt: new Date('2026-08-17T12:00:00.000Z'),
  renewsAt: new Date('2026-09-16T12:00:00.000Z'),
  allowance: 4,
  carriedUsage: 2,
  createdAt: new Date('2026-08-17T12:00:00.000Z'),
}

describe('QuotaCycleMapper', () => {
  it('reconstitutes a persisted cycle including its sequence, carried usage, and window', () => {
    const cycle = new QuotaCycleMapper().toDomain(row)

    expect(cycle).toBeInstanceOf(QuotaCycle)
    expect(cycle).toMatchObject({
      id: row.id,
      accountId: row.accountId,
      sequence: row.sequence,
      allowance: row.allowance,
      carriedUsage: row.carriedUsage,
      createdAt: row.createdAt,
    })
    expect(cycle.window.startsAt).toEqual(row.startsAt)
    expect(cycle.window.renewsAt).toEqual(row.renewsAt)
  })

  it('maps a cycle back to its persistence row without losing its window', () => {
    const mapper = new QuotaCycleMapper()
    const persisted = mapper.toPersistence(mapper.toDomain(row))

    expect(persisted).toEqual(row)
  })
})
