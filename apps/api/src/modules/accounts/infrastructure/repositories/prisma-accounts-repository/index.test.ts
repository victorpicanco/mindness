import { describe, expect, it } from 'vitest'

import { Prisma } from '@/generated/prisma/client.js'
import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { AccountAlreadyExistsError } from '@/modules/accounts/domain/errors/account-already-exists-error/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import type {
  AccountRow,
  AccountsPrismaClient,
  AccountUpsertArgs,
} from '@/modules/accounts/infrastructure/clients/accounts-prisma-client/index.js'
import { AccountsTransactionContext } from '@/modules/accounts/infrastructure/clients/accounts-transaction-context/index.js'
import { AccountMapper } from '@/modules/accounts/infrastructure/mappers/account-mapper/index.js'

import { PrismaAccountsRepository } from './index.js'

const row: AccountRow = {
  id: '2f1a3c2e-7b64-4f4a-9a1e-6f6a2c9b7d10',
  email: 'person@example.com',
  authUserId: 'auth-user-1',
  timeZone: 'America/Sao_Paulo',
  name: null,
  plan: 'free',
  status: 'accessible',
  consentPurpose: null,
  consentVersion: null,
  consentAcceptedAt: null,
  currentSessionId: null,
  createdAt: new Date('2026-08-15T00:00:00.000Z'),
}

interface FakeClient {
  readonly client: AccountsPrismaClient
  readonly upserts: AccountUpsertArgs[]
}

interface FakeClientOptions {
  readonly rows?: AccountRow[]
  readonly writeFailure?: Error
  readonly readFailure?: Error
}

function createFakeClient(options: FakeClientOptions = {}): FakeClient {
  const rows = options.rows ?? []
  const upserts: AccountUpsertArgs[] = []

  return {
    upserts,
    client: {
      account: {
        count: () => Promise.resolve(rows.length),
        findUnique: ({ where }) => {
          if (options.readFailure !== undefined) return Promise.reject(options.readFailure)
          return Promise.resolve(
            rows.find((stored) =>
              'id' in where
                ? stored.id === where.id
                : 'authUserId' in where
                  ? stored.authUserId === where.authUserId
                  : stored.email === where.email,
            ) ?? null,
          )
        },
        upsert: (args) => {
          if (options.writeFailure !== undefined) return Promise.reject(options.writeFailure)
          upserts.push(args)
          return Promise.resolve(args.create)
        },
      },
      accountDeletionRequest: {
        upsert: (args) => Promise.resolve(args.create),
      },
    },
  }
}

function uniqueViolation(fields: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.9.1',
    meta: {
      modelName: 'Account',
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: {
          originalCode: '23505',
          kind: 'UniqueConstraintViolation',
          constraint: { fields },
        },
      },
    },
  })
}

function writeConflict(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Write conflict', {
    code: 'P2034',
    clientVersion: '7.9.1',
  })
}

function anAccount(): Account {
  return Account.create({
    id: row.id,
    email: EmailAddress.create(row.email),
    authUserId: row.authUserId,
    timeZone: TimeZone.create(row.timeZone),
    createdAt: row.createdAt,
  })
}

function createRepository(
  fake: FakeClient,
  context = new AccountsTransactionContext(),
): PrismaAccountsRepository {
  return new PrismaAccountsRepository(fake.client, context, new AccountMapper())
}

describe('PrismaAccountsRepository', () => {
  it('reconstitutes the aggregate persisted for an external identity', async () => {
    const repository = createRepository(createFakeClient({ rows: [row] }))

    const account = await repository.findByAuthUserId('auth-user-1')

    expect(account).toBeInstanceOf(Account)
    expect(account).toMatchObject({
      id: row.id,
      authUserId: row.authUserId,
      plan: 'free',
      status: 'accessible',
    })
  })

  it('returns null when no account belongs to the external identity', async () => {
    const repository = createRepository(createFakeClient({ rows: [row] }))

    await expect(repository.findByAuthUserId('auth-user-2')).resolves.toBeNull()
  })

  it('reconstitutes the aggregate persisted under its domain identifier', async () => {
    const repository = createRepository(createFakeClient({ rows: [row] }))

    await expect(repository.findById(row.id)).resolves.toMatchObject({ id: row.id })
  })

  it('reconstitutes the aggregate persisted for an email address', async () => {
    const repository = createRepository(createFakeClient({ rows: [row] }))

    await expect(repository.findByEmail(row.email)).resolves.toMatchObject({ id: row.id })
  })

  it('persists the whole aggregate under its own identifier', async () => {
    const fake = createFakeClient()

    await createRepository(fake).save(anAccount())

    expect(fake.upserts).toEqual([{ where: { id: row.id }, create: row, update: row }])
  })

  it('translates a unique violation into a conflict of the domain', async () => {
    const failure = uniqueViolation(['auth_user_id'])
    const repository = createRepository(createFakeClient({ writeFailure: failure }))

    await expect(repository.save(anAccount())).rejects.toBeInstanceOf(AccountAlreadyExistsError)
    await expect(repository.save(anAccount())).rejects.toMatchObject({
      code: 'accounts.ACCOUNT_ALREADY_EXISTS',
      httpStatus: 409,
      cause: failure,
    })
  })

  it('names the conflicting fields in the vocabulary of the domain', async () => {
    const repository = createRepository(
      createFakeClient({ writeFailure: uniqueViolation(['auth_user_id', 'email']) }),
    )

    await expect(repository.save(anAccount())).rejects.toMatchObject({
      context: { fields: ['authUserId', 'email'] },
    })
  })

  it('omits constraint columns it cannot express in the vocabulary of the domain', async () => {
    const repository = createRepository(
      createFakeClient({ writeFailure: uniqueViolation(['some_future_column']) }),
    )

    await expect(repository.save(anAccount())).rejects.toMatchObject({ context: { fields: [] } })
  })

  it('translates any other write failure into a database error that keeps its cause', async () => {
    const failure = new Prisma.PrismaClientKnownRequestError('Table does not exist', {
      code: 'P2021',
      clientVersion: '7.9.1',
    })
    const repository = createRepository(createFakeClient({ writeFailure: failure }))

    await expect(repository.save(anAccount())).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      httpStatus: 500,
      cause: failure,
    })
  })

  it('translates a read failure into a database error that keeps its cause', async () => {
    const failure = new Prisma.PrismaClientKnownRequestError('Connection lost', {
      code: 'P1017',
      clientVersion: '7.9.1',
    })
    const repository = createRepository(createFakeClient({ readFailure: failure }))

    await expect(repository.findByAuthUserId('auth-user-1')).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      cause: failure,
    })
  })

  it('keeps a write conflict reachable as the cause so the transaction can be retried', async () => {
    const conflict = writeConflict()
    const repository = createRepository(createFakeClient({ writeFailure: conflict }))

    await expect(repository.save(anAccount())).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      cause: conflict,
    })
  })

  it('reads and writes through the client of the active transaction', async () => {
    const outside = createFakeClient()
    const inside = createFakeClient({ rows: [row] })
    const context = new AccountsTransactionContext()
    const repository = createRepository(outside, context)

    const account = await context.run(inside.client, async () => {
      const found = await repository.findByAuthUserId('auth-user-1')
      await repository.save(anAccount())
      return found
    })

    expect(account).not.toBeNull()
    expect(inside.upserts).toHaveLength(1)
    expect(outside.upserts).toHaveLength(0)
  })
})
