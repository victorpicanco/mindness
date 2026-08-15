import { describe, expect, it } from 'vitest'

import { AccountDeletionRequest } from '@/modules/accounts/domain/entities/account-deletion-request/index.js'
import type {
  AccountDeletionRequestUpsertArgs,
  AccountsPrismaClient,
} from '@/modules/accounts/infrastructure/clients/accounts-prisma-client/index.js'
import { AccountsTransactionContext } from '@/modules/accounts/infrastructure/clients/accounts-transaction-context/index.js'
import { AccountDeletionRequestMapper } from '@/modules/accounts/infrastructure/mappers/account-deletion-request-mapper/index.js'

import { PrismaAccountDeletionRequestsRepository } from './index.js'

describe('PrismaAccountDeletionRequestsRepository', () => {
  it('upserts one auditable deletion request per account', async () => {
    const upserts: AccountDeletionRequestUpsertArgs[] = []
    const client: AccountsPrismaClient = {
      account: {
        count: () => Promise.resolve(0),
        findUnique: () => Promise.resolve(null),
        upsert: (args) => Promise.resolve(args.create),
      },
      accountDeletionRequest: {
        upsert: (args) => {
          upserts.push(args)
          return Promise.resolve(args.create)
        },
      },
    }
    const repository = new PrismaAccountDeletionRequestsRepository(
      client,
      new AccountsTransactionContext(),
      new AccountDeletionRequestMapper(),
    )
    const request = AccountDeletionRequest.create({
      id: 'request-1',
      accountId: 'account-1',
      requestedAt: new Date('2026-08-15T12:00:00.000Z'),
      scheduledFor: new Date('2026-09-14T12:00:00.000Z'),
    })

    await repository.save(request)

    const row = new AccountDeletionRequestMapper().toPersistence(request)
    expect(upserts).toEqual([{ where: { accountId: 'account-1' }, create: row, update: row }])
  })
})
