import { Prisma } from '@/generated/prisma/client.js'
import type { UnitOfWork } from '@/modules/accounts/domain/ports/unit-of-work/index.js'
import type { AccountsPrismaTransactionRunner } from '@/modules/accounts/infrastructure/clients/accounts-prisma-client/index.js'
import type { AccountsTransactionContext } from '@/modules/accounts/infrastructure/clients/accounts-transaction-context/index.js'
import { BaseError } from '@/shared/errors/base-error/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

const WRITE_CONFLICT_CODE = 'P2034'
const DEFAULT_MAX_ATTEMPTS = 3
const BASE_RETRY_DELAY_MS = 10

export type RetryDelay = (attempt: number) => Promise<void>

export interface PrismaUnitOfWorkOptions {
  readonly maxAttempts?: number
  readonly retryDelay?: RetryDelay
}

const DRIVER_ADAPTER_ERROR_NAME = 'DriverAdapterError'
const DRIVER_ADAPTER_WRITE_CONFLICT = 'TransactionWriteConflict'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDriverAdapterWriteConflict(error: unknown): boolean {
  if (!(error instanceof Error) || error.name !== DRIVER_ADAPTER_ERROR_NAME) return false
  if (error.message === DRIVER_ADAPTER_WRITE_CONFLICT) return true

  return isRecord(error.cause) && error.cause.kind === DRIVER_ADAPTER_WRITE_CONFLICT
}

function isWriteConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === WRITE_CONFLICT_CODE
  }

  if (isDriverAdapterWriteConflict(error)) return true

  if (error instanceof BaseError) return isWriteConflict(error.cause)

  return false
}

function backOff(attempt: number): Promise<void> {
  const ceiling = BASE_RETRY_DELAY_MS * 2 ** attempt

  return new Promise<void>((resolve) => {
    setTimeout(resolve, Math.random() * ceiling)
  })
}

export class PrismaUnitOfWorkAdapter implements UnitOfWork {
  private readonly maxAttempts: number
  private readonly retryDelay: RetryDelay

  constructor(
    private readonly prisma: AccountsPrismaTransactionRunner,
    private readonly transactionContext: AccountsTransactionContext,
    options?: PrismaUnitOfWorkOptions,
  ) {
    this.maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
    this.retryDelay = options?.retryDelay ?? backOff
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    let lastConflict: unknown

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (transaction) => this.transactionContext.run(transaction, operation),
          { isolationLevel: 'Serializable' },
        )
      } catch (error) {
        if (!isWriteConflict(error)) throw error
        lastConflict = error
      }

      if (attempt + 1 < this.maxAttempts) await this.retryDelay(attempt)
    }

    throw new DatabaseError('Transaction gave up after repeated write conflicts', {
      cause: lastConflict,
      context: { attempts: this.maxAttempts },
    })
  }
}
