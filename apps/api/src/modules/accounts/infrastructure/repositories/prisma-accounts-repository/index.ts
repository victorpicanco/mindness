import { Prisma } from '@/generated/prisma/client.js'
import type { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { AccountAlreadyExistsError } from '@/modules/accounts/domain/errors/account-already-exists-error/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import type {
  AccountRow,
  AccountsPrismaClient,
} from '@/modules/accounts/infrastructure/clients/accounts-prisma-client/index.js'
import type { AccountsTransactionContext } from '@/modules/accounts/infrastructure/clients/accounts-transaction-context/index.js'
import type { AccountMapper } from '@/modules/accounts/infrastructure/mappers/account-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

const UNIQUE_VIOLATION_CODE = 'P2002'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CONSTRAINT_FIELDS_PATH = ['driverAdapterError', 'cause', 'constraint', 'fields']

const DOMAIN_FIELD_BY_COLUMN = new Map<string, string>([
  ['id', 'id'],
  ['email', 'email'],
  ['auth_user_id', 'authUserId'],
])

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

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION_CODE
  )
}

function conflictingFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const columns = readPath(error.meta, CONSTRAINT_FIELDS_PATH)

  if (!Array.isArray(columns)) return []

  const fields: string[] = []

  for (const column of columns) {
    if (typeof column !== 'string') continue
    const field = DOMAIN_FIELD_BY_COLUMN.get(column)
    if (field !== undefined) fields.push(field)
  }

  return fields
}

export class PrismaAccountsRepository implements AccountsRepository {
  constructor(
    private readonly prisma: AccountsPrismaClient,
    private readonly transactionContext: AccountsTransactionContext,
    private readonly mapper: AccountMapper,
  ) {}

  async count(): Promise<number> {
    try {
      return await this.client().account.count()
    } catch (error) {
      throw new DatabaseError('Failed to count accounts', { cause: error })
    }
  }

  async findByAuthUserId(authUserId: string): Promise<Account | null> {
    const row = await this.readByAuthUserId(authUserId)

    return row === null ? null : this.mapper.toDomain(row)
  }

  async findById(accountId: string): Promise<Account | null> {
    const row = await this.readById(accountId)

    return row === null ? null : this.mapper.toDomain(row)
  }

  async findByEmail(email: string): Promise<Account | null> {
    const row = await this.readByEmail(email)

    return row === null ? null : this.mapper.toDomain(row)
  }

  async save(account: Account): Promise<void> {
    const row = this.mapper.toPersistence(account)

    try {
      await this.client().account.upsert({ where: { id: row.id }, create: row, update: row })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AccountAlreadyExistsError(conflictingFields(error), { cause: error })
      }

      throw new DatabaseError('Failed to save the account', {
        cause: error,
        context: { accountId: row.id },
      })
    }
  }

  private async readByAuthUserId(authUserId: string): Promise<AccountRow | null> {
    try {
      return await this.client().account.findUnique({ where: { authUserId } })
    } catch (error) {
      throw new DatabaseError('Failed to read the account', { cause: error })
    }
  }

  private async readById(accountId: string): Promise<AccountRow | null> {
    if (!UUID_PATTERN.test(accountId)) return null

    try {
      return await this.client().account.findUnique({ where: { id: accountId } })
    } catch (error) {
      throw new DatabaseError('Failed to read the account', { cause: error })
    }
  }

  private async readByEmail(email: string): Promise<AccountRow | null> {
    try {
      return await this.client().account.findUnique({ where: { email } })
    } catch (error) {
      throw new DatabaseError('Failed to read the account', { cause: error })
    }
  }

  private client(): AccountsPrismaClient {
    return this.transactionContext.current() ?? this.prisma
  }
}
