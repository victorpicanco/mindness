import { describe, expect, it } from 'vitest'

import { Prisma } from '@/generated/prisma/client.js'
import { QuotaReservation } from '@/modules/quota/domain/entities/quota-reservation/index.js'
import type {
  QuotaReservationCountArgs,
  QuotaReservationRow,
  QuotaReservationsPrismaClient,
} from '@/modules/quota/infrastructure/clients/quota-prisma-client/index.js'
import { QuotaTransactionContext } from '@/modules/quota/infrastructure/clients/quota-transaction-context/index.js'
import { QuotaReservationMapper } from '@/modules/quota/infrastructure/mappers/quota-reservation-mapper/index.js'

import { PrismaQuotaReservationsRepository } from './index.js'

const row: QuotaReservationRow = {
  id: '6f3a143d-6853-48f0-b414-a57d8b65f101',
  accountId: '97784f56-9b46-44a4-a0d2-52e97d2fe201',
  cycleId: 'caf10e0d-969b-4f05-9a4a-9d487e7a1301',
  sessionId: 'session-1',
  status: 'held',
  createdAt: new Date('2026-08-17T12:00:00.000Z'),
  resolvedAt: null,
}
const CYCLE_ID = 'caf10e0d-969b-4f05-9a4a-9d487e7a1301'

interface FakeClient {
  readonly client: QuotaReservationsPrismaClient
  readonly countArgs: QuotaReservationCountArgs[]
  readonly upserts: number[]
}

function createFakeClient(
  writeFailure?: Error,
  foundRow: QuotaReservationRow | null = null,
): FakeClient {
  const countArgs: QuotaReservationCountArgs[] = []
  const upserts: number[] = []

  return {
    countArgs,
    upserts,
    client: {
      quotaReservation: {
        count: (args) => {
          countArgs.push(args)
          return Promise.resolve(0)
        },
        findUnique: () => Promise.resolve(foundRow),
        upsert: (args) => {
          if (writeFailure !== undefined) return Promise.reject(writeFailure)
          upserts.push(1)
          return Promise.resolve(args.create)
        },
      },
    },
  }
}

function sessionUniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.9.1',
    meta: {
      modelName: 'QuotaReservation',
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: {
          originalCode: '23505',
          kind: 'UniqueConstraintViolation',
          constraint: { fields: ['session_id'] },
        },
      },
    },
  })
}

function reservation(): QuotaReservation {
  return QuotaReservation.create({
    id: row.id,
    accountId: row.accountId,
    cycleId: row.cycleId,
    sessionId: row.sessionId,
    createdAt: row.createdAt,
  })
}

describe('PrismaQuotaReservationsRepository', () => {
  it('translates a session id unique violation while preserving its cause', async () => {
    const failure = sessionUniqueViolation()
    const fake = createFakeClient(failure)
    const repository = new PrismaQuotaReservationsRepository(
      fake.client,
      new QuotaTransactionContext(),
      new QuotaReservationMapper(),
    )

    await expect(repository.save(reservation())).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      cause: failure,
    })
  })

  it('counts held and consumed reservations separately and ignores released reservations', async () => {
    const fake = createFakeClient()
    const repository = new PrismaQuotaReservationsRepository(
      fake.client,
      new QuotaTransactionContext(),
      new QuotaReservationMapper(),
    )

    await expect(repository.countByCycle(CYCLE_ID)).resolves.toEqual({ held: 0, consumed: 0 })

    expect(fake.countArgs).toEqual([
      { where: { cycleId: CYCLE_ID, status: 'held' } },
      { where: { cycleId: CYCLE_ID, status: 'consumed' } },
    ])
  })

  it('reconstitutes a found reservation instead of exposing its persistence row', async () => {
    const fake = createFakeClient(undefined, row)
    const repository = new PrismaQuotaReservationsRepository(
      fake.client,
      new QuotaTransactionContext(),
      new QuotaReservationMapper(),
    )

    await expect(repository.findBySessionId(row.sessionId)).resolves.toBeInstanceOf(
      QuotaReservation,
    )
  })

  it('counts consumed reservations since an instant independently of their cycle', async () => {
    const fake = createFakeClient()
    const repository = new PrismaQuotaReservationsRepository(
      fake.client,
      new QuotaTransactionContext(),
      new QuotaReservationMapper(),
    )
    const since = new Date('2026-08-01T00:00:00.000Z')

    await repository.countConsumedSince(row.accountId, since)

    expect(fake.countArgs).toEqual([
      { where: { accountId: row.accountId, status: 'consumed', resolvedAt: { gte: since } } },
    ])
  })

  it('uses the active transaction client instead of the global client', async () => {
    const outside = createFakeClient()
    const inside = createFakeClient()
    const context = new QuotaTransactionContext()
    const repository = new PrismaQuotaReservationsRepository(
      outside.client,
      context,
      new QuotaReservationMapper(),
    )

    await context.run(
      {
        ...inside.client,
        quotaCycle: {
          findFirst: () => Promise.resolve(null),
          create: () =>
            Promise.resolve({
              id: 'cycle-1',
              accountId: row.accountId,
              sequence: 1,
              startsAt: row.createdAt,
              renewsAt: row.createdAt,
              allowance: 4,
              carriedUsage: 0,
              createdAt: row.createdAt,
            }),
        },
      },
      async () => repository.save(reservation()),
    )

    expect(inside.upserts).toHaveLength(1)
    expect(outside.upserts).toHaveLength(0)
  })
})
