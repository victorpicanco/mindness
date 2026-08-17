import { describe, expect, it } from 'vitest'

import { Prisma } from '@/generated/prisma/client.js'
import { QuotaCycle } from '@/modules/quota/domain/entities/quota-cycle/index.js'
import { QuotaCycleAlreadyOpenError } from '@/modules/quota/domain/errors/quota-cycle-already-open-error/index.js'
import type {
  QuotaCycleCreateArgs,
  QuotaCycleFindCurrentArgs,
  QuotaCycleFindLatestArgs,
  QuotaCyclesPrismaClient,
} from '@/modules/quota/infrastructure/clients/quota-prisma-client/index.js'
import { QuotaTransactionContext } from '@/modules/quota/infrastructure/clients/quota-transaction-context/index.js'
import { QuotaCycleMapper } from '@/modules/quota/infrastructure/mappers/quota-cycle-mapper/index.js'

import { PrismaQuotaCyclesRepository } from './index.js'

const STARTS_AT = new Date('2026-08-17T12:00:00.000Z')
const row = {
  id: '6f3a143d-6853-48f0-b414-a57d8b65f101',
  accountId: '97784f56-9b46-44a4-a0d2-52e97d2fe201',
  sequence: 1,
  startsAt: STARTS_AT,
  renewsAt: new Date('2026-09-16T12:00:00.000Z'),
  allowance: 4,
  carriedUsage: 0,
  createdAt: STARTS_AT,
}

interface FakeClient {
  readonly client: QuotaCyclesPrismaClient
  readonly findArgs: (QuotaCycleFindCurrentArgs | QuotaCycleFindLatestArgs)[]
}

function createFakeClient(writeFailure?: Error): FakeClient {
  const findArgs: (QuotaCycleFindCurrentArgs | QuotaCycleFindLatestArgs)[] = []

  return {
    findArgs,
    client: {
      quotaCycle: {
        findFirst: (args: QuotaCycleFindCurrentArgs | QuotaCycleFindLatestArgs) => {
          findArgs.push(args)
          return Promise.resolve(row)
        },
        create: (args: QuotaCycleCreateArgs) => {
          if (writeFailure !== undefined) return Promise.reject(writeFailure)
          return Promise.resolve(args.data)
        },
      },
    },
  }
}

function cycle(): QuotaCycle {
  return new QuotaCycleMapper().toDomain(row)
}

function cycleAlreadyOpenViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.9.1',
    meta: { target: 'quota_cycles_account_id_starts_at_key' },
  })
}

describe('PrismaQuotaCyclesRepository', () => {
  it('finds a current cycle using the closed-open window bounds', async () => {
    const fake = createFakeClient()
    const repository = new PrismaQuotaCyclesRepository(
      fake.client,
      new QuotaTransactionContext(),
      new QuotaCycleMapper(),
    )

    await expect(repository.findCurrent(row.accountId, STARTS_AT)).resolves.toBeInstanceOf(
      QuotaCycle,
    )

    expect(fake.findArgs).toEqual([
      {
        where: {
          accountId: row.accountId,
          startsAt: { lte: STARTS_AT },
          renewsAt: { gt: STARTS_AT },
        },
      },
    ])
  })

  it('translates the open cycle unique constraint while preserving its cause', async () => {
    const failure = cycleAlreadyOpenViolation()
    const fake = createFakeClient(failure)
    const repository = new PrismaQuotaCyclesRepository(
      fake.client,
      new QuotaTransactionContext(),
      new QuotaCycleMapper(),
    )

    await expect(repository.save(cycle())).rejects.toBeInstanceOf(QuotaCycleAlreadyOpenError)
    await expect(repository.save(cycle())).rejects.toMatchObject({ cause: failure })
  })
})
