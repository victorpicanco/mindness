import type { AccountDeletionRequest } from '@/modules/accounts/domain/entities/account-deletion-request/index.js'
import type { AccountDeletionRequestsRepository } from '@/modules/accounts/domain/repositories/account-deletion-requests-repository/index.js'
import type { AccountsPrismaClient } from '@/modules/accounts/infrastructure/clients/accounts-prisma-client/index.js'
import type { AccountsTransactionContext } from '@/modules/accounts/infrastructure/clients/accounts-transaction-context/index.js'
import type { AccountDeletionRequestMapper } from '@/modules/accounts/infrastructure/mappers/account-deletion-request-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

export class PrismaAccountDeletionRequestsRepository implements AccountDeletionRequestsRepository {
  constructor(
    private readonly prisma: AccountsPrismaClient,
    private readonly transactionContext: AccountsTransactionContext,
    private readonly mapper: AccountDeletionRequestMapper,
  ) {}

  async save(request: AccountDeletionRequest): Promise<void> {
    const row = this.mapper.toPersistence(request)

    try {
      await this.client().accountDeletionRequest.upsert({
        where: { accountId: row.accountId },
        create: row,
        update: row,
      })
    } catch (error) {
      throw new DatabaseError('Failed to save the account deletion request', {
        cause: error,
        context: { accountId: row.accountId, deletionRequestId: row.id },
      })
    }
  }

  private client(): AccountsPrismaClient {
    return this.transactionContext.current() ?? this.prisma
  }
}
