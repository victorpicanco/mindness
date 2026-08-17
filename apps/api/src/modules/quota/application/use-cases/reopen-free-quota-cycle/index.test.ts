import { describe, expect, it } from 'vitest'

import { QuotaCycle } from '@/modules/quota/domain/entities/quota-cycle/index.js'
import { QuotaReservation } from '@/modules/quota/domain/entities/quota-reservation/index.js'
import type { QuotaReservationCounts } from '@/modules/quota/domain/entities/quota-reservation/types.js'
import type { Clock } from '@/modules/quota/domain/ports/clock/index.js'
import type { IdGenerator } from '@/modules/quota/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/quota/domain/ports/unit-of-work/index.js'
import type { QuotaCyclesRepository } from '@/modules/quota/domain/repositories/quota-cycles-repository/index.js'
import type { QuotaReservationsRepository } from '@/modules/quota/domain/repositories/quota-reservations-repository/index.js'
import { CycleWindow } from '@/modules/quota/domain/value-objects/cycle-window/index.js'

import { ReopenFreeQuotaCycleUseCase } from './index.js'

const ACCOUNT_ID = 'account-1'
const REENTRY_AT = new Date('2026-08-17T12:00:00.000Z')
const RENEWS_AT = new Date('2026-09-16T12:00:00.000Z')
const WITHIN_PREVIOUS_WINDOW = new Date('2026-08-01T00:00:00.000Z')
const BEFORE_PREVIOUS_WINDOW = new Date('2026-07-17T00:00:00.000Z')

interface Harness {
  readonly cycles: QuotaCycle[]
  readonly saved: QuotaReservation[]
  readonly useCase: ReopenFreeQuotaCycleUseCase
}

function createHeldReservation(createdAt: Date, sessionId: string): QuotaReservation {
  return QuotaReservation.create({
    id: `reservation-${sessionId}`,
    accountId: ACCOUNT_ID,
    cycleId: null,
    sessionId,
    createdAt,
  })
}

function createHarness(
  params: {
    readonly consumedAt?: readonly Date[]
    readonly reservations?: readonly QuotaReservation[]
    readonly latestCycle?: QuotaCycle
  } = {},
): Harness {
  const consumedAt = params.consumedAt ?? []
  const reservations = params.reservations ?? []
  const cycles: QuotaCycle[] = params.latestCycle === undefined ? [] : [params.latestCycle]
  const saved: QuotaReservation[] = []
  let generatedId = 0

  const clock: Clock = { now: () => REENTRY_AT }
  const idGenerator: IdGenerator = {
    generate: () => {
      generatedId += 1
      return `cycle-${generatedId}`
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
    findBySessionId: () => Promise.resolve(null),
    findHeldByAccountSince: (accountId, since) =>
      Promise.resolve(
        reservations.filter(
          (reservation) =>
            reservation.accountId === accountId &&
            reservation.status === 'held' &&
            reservation.createdAt.getTime() >= since.getTime(),
        ),
      ),
    countByCycle: (cycleId) =>
      Promise.resolve(
        reservations.reduce<QuotaReservationCounts>(
          (counts, reservation) => {
            if (reservation.cycleId !== cycleId) return counts
            if (reservation.status === 'held') return { ...counts, held: counts.held + 1 }
            if (reservation.status === 'consumed')
              return { ...counts, consumed: counts.consumed + 1 }
            return counts
          },
          { held: 0, consumed: 0 },
        ),
      ),
    countConsumedSince: (accountId, since) =>
      Promise.resolve(consumedAt.filter((instant) => instant.getTime() >= since.getTime()).length),
    save: (reservation) => {
      saved.push(reservation)
      return Promise.resolve()
    },
  }

  return {
    cycles,
    saved,
    useCase: new ReopenFreeQuotaCycleUseCase({
      clock,
      idGenerator,
      quotaCycles,
      quotaReservations,
      unitOfWork,
    }),
  }
}

describe('ReopenFreeQuotaCycleUseCase', () => {
  it('carries the usage of the previous thirty days into the reopened cycle', async () => {
    const harness = createHarness({
      consumedAt: [WITHIN_PREVIOUS_WINDOW, new Date('2026-07-20T00:00:00.000Z')],
    })

    await expect(harness.useCase.execute({ accountId: ACCOUNT_ID })).resolves.toEqual({
      allowance: 4,
      remaining: 2,
      renewsAt: RENEWS_AT,
    })
    expect(harness.cycles[0]?.carriedUsage).toBe(2)
  })

  it('saturates the carried usage at the allowance instead of going negative', async () => {
    const harness = createHarness({
      consumedAt: Array.from({ length: 6 }, () => WITHIN_PREVIOUS_WINDOW),
    })

    await expect(harness.useCase.execute({ accountId: ACCOUNT_ID })).resolves.toMatchObject({
      remaining: 0,
    })
    expect(harness.cycles[0]?.carriedUsage).toBe(4)
  })

  it('reopens with the full balance when nothing was consumed', async () => {
    const harness = createHarness()

    await expect(harness.useCase.execute({ accountId: ACCOUNT_ID })).resolves.toMatchObject({
      remaining: 4,
    })
    expect(harness.cycles[0]?.carriedUsage).toBe(0)
  })

  it('anchors the new window at the reentry instant and continues the cycle history', async () => {
    const previousCycle = QuotaCycle.create({
      id: 'cycle-0',
      accountId: ACCOUNT_ID,
      sequence: 3,
      window: CycleWindow.create(new Date('2026-08-10T00:00:00.000Z')),
      allowance: 4,
      carriedUsage: 0,
      createdAt: new Date('2026-08-10T00:00:00.000Z'),
    })
    const harness = createHarness({ latestCycle: previousCycle })

    await harness.useCase.execute({ accountId: ACCOUNT_ID })

    expect(harness.cycles).toHaveLength(2)
    expect(harness.cycles[1]?.window.startsAt).toEqual(REENTRY_AT)
    expect(harness.cycles[1]?.window.renewsAt).toEqual(RENEWS_AT)
    expect(harness.cycles[1]?.sequence).toBe(4)
  })

  it('ignores analyses completed before the previous window', async () => {
    const harness = createHarness({ consumedAt: [BEFORE_PREVIOUS_WINDOW] })

    await expect(harness.useCase.execute({ accountId: ACCOUNT_ID })).resolves.toMatchObject({
      remaining: 4,
    })
    expect(harness.cycles[0]?.carriedUsage).toBe(0)
  })

  it('keeps a reservation held across the reentry discounting from the reopened cycle', async () => {
    const heldReservation = createHeldReservation(new Date('2026-08-16T12:00:00.000Z'), 'session-1')
    const harness = createHarness({ reservations: [heldReservation] })

    await expect(harness.useCase.execute({ accountId: ACCOUNT_ID })).resolves.toMatchObject({
      remaining: 3,
    })
    expect(heldReservation.cycleId).toBe(harness.cycles[0]?.id)
    expect(heldReservation.status).toBe('held')
    expect(harness.saved).toEqual([heldReservation])
  })

  it('leaves reservations held since before the previous window out of the reopened cycle', async () => {
    const staleReservation = createHeldReservation(
      new Date('2026-07-10T00:00:00.000Z'),
      'session-1',
    )
    const harness = createHarness({ reservations: [staleReservation] })

    await expect(harness.useCase.execute({ accountId: ACCOUNT_ID })).resolves.toMatchObject({
      remaining: 4,
    })
    expect(staleReservation.cycleId).toBeNull()
    expect(harness.saved).toEqual([])
  })

  it('reopens only once when called twice at the same instant', async () => {
    const heldReservation = createHeldReservation(new Date('2026-08-16T12:00:00.000Z'), 'session-1')
    const harness = createHarness({ reservations: [heldReservation] })

    const firstOutput = await harness.useCase.execute({ accountId: ACCOUNT_ID })
    const secondOutput = await harness.useCase.execute({ accountId: ACCOUNT_ID })

    expect(harness.cycles).toHaveLength(1)
    expect(secondOutput).toEqual(firstOutput)
  })
})
