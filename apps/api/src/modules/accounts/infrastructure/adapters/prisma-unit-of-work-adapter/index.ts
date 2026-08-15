import { Prisma } from '@/generated/prisma/client.js'
import type { TransactionContext } from '@/shared/database/transaction-context/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

import type { UnitOfWork } from '../../../domain/ports/unit-of-work/index.js'
import type {
  AccountsPrismaClient,
  AccountsPrismaTransactionRunner,
} from '../../clients/accounts-prisma-client/index.js'

const WRITE_CONFLICT_CODE = 'P2034'
const DEFAULT_MAX_ATTEMPTS = 3

function isWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === WRITE_CONFLICT_CODE
}

export class PrismaUnitOfWorkAdapter implements UnitOfWork {
  constructor(
    private readonly prisma: AccountsPrismaTransactionRunner,
    private readonly transactionContext: TransactionContext<AccountsPrismaClient>,
    private readonly maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  ) {}

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
    }

    throw new DatabaseError('Transaction gave up after repeated write conflicts', {
      cause: lastConflict,
      context: { attempts: this.maxAttempts },
    })
  }
}
