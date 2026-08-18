import { describe, expect, it } from 'vitest'

import type { QuotaCycle } from '@/modules/quota/domain/entities/quota-cycle/index.js'
import type { QuotaReservation } from '@/modules/quota/domain/entities/quota-reservation/index.js'
import type { QuotaReservationCounts } from '@/modules/quota/domain/entities/quota-reservation/types.js'
import type { AccountsPort } from '@/modules/quota/domain/ports/accounts-port/index.js'
import type { Clock } from '@/modules/quota/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/quota/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/quota/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/quota/domain/ports/unit-of-work/index.js'
import type { QuotaCyclesRepository } from '@/modules/quota/domain/repositories/quota-cycles-repository/index.js'
import type { QuotaReservationsRepository } from '@/modules/quota/domain/repositories/quota-reservations-repository/index.js'
import type { QuotaPlan } from '@/modules/quota/domain/services/quota-policy/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

import { ReserveQuotaUseCase } from './index.js'

const ACCOUNT_CREATED_AT = new Date('2026-08-01T00:00:00.000Z')

interface Harness {
  readonly cycles: QuotaCycle[]
  readonly events: IntegrationEvent[]
  readonly reservations: QuotaReservation[]
  setNow(now: Date): void
  readonly useCase: ReserveQuotaUseCase
}

function createHarness(params: { readonly plan?: QuotaPlan } = {}): Harness {
  const cycles: QuotaCycle[] = []
  const events: IntegrationEvent[] = []
  const reservations: QuotaReservation[] = []
  let now = ACCOUNT_CREATED_AT
  let generatedId = 0
  const plan = params.plan ?? 'free'
  const accounts: AccountsPort = {
    findAccount: (accountId) => Promise.resolve({ accountId, plan, createdAt: ACCOUNT_CREATED_AT }),
  }
  const clock: Clock = { now: () => now }
  const eventPublisher: EventPublisher = {
    publish: (event) => {
      events.push(event)
      return Promise.resolve()
    },
  }
  const idGenerator: IdGenerator = {
    generate: () => {
      generatedId += 1
      return `id-${generatedId}`
    },
  }
  const unitOfWork: UnitOfWork = { run: (operation) => operation() }
  const quotaCycles: QuotaCyclesRepository = {
    findCurrent: (accountId, at) =>
      Promise.resolve(
        cycles.find((cycle) => cycle.accountId === accountId && cycle.window.contains(at)) ?? null,
      ),
    findLatest: (accountId) =>
      Promise.resolve(cycles.filter((cycle) => cycle.accountId === accountId).at(-1) ?? null),
    save: (cycle) => {
      cycles.push(cycle)
      return Promise.resolve()
    },
  }
  const quotaReservations: QuotaReservationsRepository = {
    findBySessionId: (sessionId) =>
      Promise.resolve(
        reservations.find((reservation) => reservation.sessionId === sessionId) ?? null,
      ),
    findHeldByAccountSince: () => Promise.resolve([]),
    countByCycle: (cycleId) => {
      const counts = reservations.reduce<QuotaReservationCounts>(
        (current, reservation) => {
          if (reservation.cycleId !== cycleId) return current
          if (reservation.status === 'held') return { ...current, held: current.held + 1 }
          if (reservation.status === 'consumed')
            return { ...current, consumed: current.consumed + 1 }
          return current
        },
        { held: 0, consumed: 0 },
      )
      return Promise.resolve(counts)
    },
    countConsumedSince: () => Promise.resolve(0),
    save: (reservation) => {
      reservations.push(reservation)
      return Promise.resolve()
    },
  }

  return {
    cycles,
    events,
    reservations,
    setNow: (nextNow) => {
      now = nextNow
    },
    useCase: new ReserveQuotaUseCase({
      accounts,
      clock,
      eventPublisher,
      idGenerator,
      quotaCycles,
      quotaReservations,
      unitOfWork,
    }),
  }
}

describe('ReserveQuotaUseCase', () => {
  it('reserves a free quota unit and decrements the remaining balance', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).resolves.toEqual({
      reservationId: 'id-2',
      enforced: true,
      remaining: 3,
    })
    expect(harness.reservations).toHaveLength(1)
  })

  it('rejects the fifth reservation and publishes the exhausted event after the transaction', async () => {
    const harness = createHarness()

    for (let index = 1; index <= 4; index += 1) {
      await harness.useCase.execute({ accountId: 'account-1', sessionId: `session-${index}` })
    }

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-5' }),
    ).rejects.toMatchObject({
      code: 'quota.QUOTA_EXHAUSTED',
    })
    expect(harness.reservations).toHaveLength(4)
    expect(harness.events).toHaveLength(1)
    expect(harness.events[0]).toMatchObject({
      eventName: 'quota_exhausted',
      payload: { renewsAt: '2026-08-31T00:00:00.000Z' },
    })
  })

  it.each(['held', 'consumed', 'released'] as const)(
    'returns an existing %s reservation without consuming another unit',
    async (status) => {
      const harness = createHarness()
      await harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' })
      const reservation = harness.reservations[0]
      if (reservation === undefined) {
        expect.fail('Expected a reservation')
        return
      }
      if (status === 'consumed') reservation.consume(ACCOUNT_CREATED_AT)
      if (status === 'released') reservation.release(ACCOUNT_CREATED_AT)

      await expect(
        harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
      ).resolves.toMatchObject({ reservationId: reservation.id })
      expect(harness.reservations).toHaveLength(1)
      expect(reservation.status).toBe(status)
    },
  )

  it('always reserves for a paid account without creating a cycle or publishing exhaustion', async () => {
    const harness = createHarness({ plan: 'plus' })

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).resolves.toEqual({
      reservationId: 'id-1',
      enforced: false,
    })
    expect(harness.reservations[0]?.cycleId).toBeNull()
    expect(harness.cycles).toEqual([])
    expect(harness.events).toEqual([])
  })

  it('opens the current cycle window before reserving', async () => {
    const harness = createHarness()
    harness.setNow(new Date('2026-09-01T00:00:00.000Z'))

    await harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' })

    expect(harness.cycles[0]?.window.startsAt).toEqual(new Date('2026-08-31T00:00:00.000Z'))
  })
})
