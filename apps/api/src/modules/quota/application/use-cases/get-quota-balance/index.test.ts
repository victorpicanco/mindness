import { describe, expect, it } from 'vitest'

import type { QuotaCycle } from '@/modules/quota/domain/entities/quota-cycle/index.js'
import type { QuotaReservationCounts } from '@/modules/quota/domain/entities/quota-reservation/types.js'
import { QuotaAccountNotFoundError } from '@/modules/quota/domain/errors/quota-account-not-found-error/index.js'
import type { AccountsPort } from '@/modules/quota/domain/ports/accounts-port/index.js'
import type { Clock } from '@/modules/quota/domain/ports/clock/index.js'
import type { IdGenerator } from '@/modules/quota/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/quota/domain/ports/unit-of-work/index.js'
import type { QuotaCyclesRepository } from '@/modules/quota/domain/repositories/quota-cycles-repository/index.js'
import type { QuotaReservationsRepository } from '@/modules/quota/domain/repositories/quota-reservations-repository/index.js'
import type { QuotaPlan } from '@/modules/quota/domain/services/quota-policy/index.js'

import { GetQuotaBalanceUseCase } from './index.js'

const ACCOUNT_CREATED_AT = new Date('2026-08-01T00:00:00.000Z')

interface Harness {
  readonly cycles: QuotaCycle[]
  setNow(now: Date): void
  readonly useCase: GetQuotaBalanceUseCase
}

function createHarness(
  params: {
    readonly now?: Date
    readonly plan?: QuotaPlan
    readonly counts?: QuotaReservationCounts
    readonly accountExists?: boolean
  } = {},
): Harness {
  const cycles: QuotaCycle[] = []
  let now = params.now ?? ACCOUNT_CREATED_AT
  const plan = params.plan ?? 'free'
  const counts = params.counts ?? { held: 0, consumed: 0 }
  const accountExists = params.accountExists ?? true
  let generatedId = 0

  const accounts: AccountsPort = {
    findAccount: (accountId) =>
      Promise.resolve(accountExists ? { accountId, plan, createdAt: ACCOUNT_CREATED_AT } : null),
  }
  const clock: Clock = { now: () => now }
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
    findHeldByAccountSince: () => Promise.resolve([]),
    countByCycle: () => Promise.resolve(counts),
    countConsumedSince: () => Promise.resolve(0),
    save: () => Promise.resolve(),
  }

  return {
    cycles,
    setNow: (nextNow) => {
      now = nextNow
    },
    useCase: new GetQuotaBalanceUseCase({
      accounts,
      clock,
      idGenerator,
      quotaCycles,
      quotaReservations,
      unitOfWork,
    }),
  }
}

describe('GetQuotaBalanceUseCase', () => {
  it('opens the first free cycle with its full balance', async () => {
    const harness = createHarness()

    await expect(harness.useCase.execute({ accountId: 'account-1' })).resolves.toEqual({
      enforced: true,
      allowance: 4,
      remaining: 4,
      renewsAt: new Date('2026-08-31T00:00:00.000Z'),
    })
    expect(harness.cycles).toHaveLength(1)
    expect(harness.cycles[0]).toMatchObject({ sequence: 1, allowance: 4, carriedUsage: 0 })
  })

  it('reuses the current cycle on a second read', async () => {
    const harness = createHarness()

    await harness.useCase.execute({ accountId: 'account-1' })
    await harness.useCase.execute({ accountId: 'account-1' })

    expect(harness.cycles).toHaveLength(1)
  })

  it('opens the next window after the current cycle has expired', async () => {
    const harness = createHarness()

    await harness.useCase.execute({ accountId: 'account-1' })
    harness.setNow(new Date('2026-09-01T00:00:00.000Z'))

    await expect(harness.useCase.execute({ accountId: 'account-1' })).resolves.toEqual({
      enforced: true,
      allowance: 4,
      remaining: 4,
      renewsAt: new Date('2026-09-30T00:00:00.000Z'),
    })
    expect(harness.cycles).toHaveLength(2)
    expect(harness.cycles[1]?.sequence).toBe(2)
  })

  it('opens only the current window after more than one cycle elapsed', async () => {
    const harness = createHarness()

    await harness.useCase.execute({ accountId: 'account-1' })
    harness.setNow(new Date('2026-10-01T00:00:00.000Z'))
    await harness.useCase.execute({ accountId: 'account-1' })

    expect(harness.cycles).toHaveLength(2)
    expect(harness.cycles[1]?.sequence).toBe(2)
    expect(harness.cycles[1]?.window.startsAt).toEqual(new Date('2026-09-30T00:00:00.000Z'))
  })

  it('subtracts held reservations from the current balance', async () => {
    const harness = createHarness({ counts: { held: 2, consumed: 1 } })

    await expect(harness.useCase.execute({ accountId: 'account-1' })).resolves.toMatchObject({
      enforced: true,
      remaining: 1,
    })
  })

  it('does not enforce or create a cycle for a paid account', async () => {
    const harness = createHarness({ plan: 'plus' })

    await expect(harness.useCase.execute({ accountId: 'account-1' })).resolves.toEqual({
      enforced: false,
    })
    expect(harness.cycles).toEqual([])
  })

  it('throws when the account does not exist', async () => {
    const harness = createHarness({ accountExists: false })

    await expect(harness.useCase.execute({ accountId: 'account-1' })).rejects.toBeInstanceOf(
      QuotaAccountNotFoundError,
    )
  })
})
