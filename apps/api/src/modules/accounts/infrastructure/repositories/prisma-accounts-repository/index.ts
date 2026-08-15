import { Prisma } from '@/generated/prisma/client.js'
import type { TransactionContext } from '@/shared/database/transaction-context/index.js'

import type { Account } from '../../../domain/entities/account/index.js'
import { AccountAlreadyExistsError } from '../../../domain/errors/account-already-exists-error/index.js'
import type { AccountsRepository } from '../../../domain/repositories/accounts-repository/index.js'
import type { AccountsPrismaClient } from '../../clients/accounts-prisma-client/index.js'
import type { AccountMapper } from '../../mappers/account-mapper/index.js'

const UNIQUE_VIOLATION_CODE = 'P2002'

// The pg driver adapter reports the violated constraint here instead of in `meta.target`.
const CONSTRAINT_FIELDS_PATH = ['driverAdapterError', 'cause', 'constraint', 'fields']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let current = value

  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }

  return current
}

function conflictingFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const fields = readPath(error.meta, CONSTRAINT_FIELDS_PATH)

  if (!Array.isArray(fields)) return []

  return fields.filter((field): field is string => typeof field === 'string')
}

export class PrismaAccountsRepository implements AccountsRepository {
  constructor(
    private readonly prisma: AccountsPrismaClient,
    private readonly transactionContext: TransactionContext<AccountsPrismaClient>,
    private readonly mapper: AccountMapper,
  ) {}

  async findByAuthUserId(authUserId: string): Promise<Account | null> {
    const row = await this.client().account.findUnique({ where: { authUserId } })

    return row === null ? null : this.mapper.toDomain(row)
  }

  async save(account: Account): Promise<void> {
    const row = this.mapper.toPersistence(account)

    try {
      await this.client().account.upsert({ where: { id: row.id }, create: row, update: row })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION_CODE
      ) {
        throw new AccountAlreadyExistsError(conflictingFields(error))
      }

      throw error
    }
  }

  private client(): AccountsPrismaClient {
    return this.transactionContext.current() ?? this.prisma
  }
}
