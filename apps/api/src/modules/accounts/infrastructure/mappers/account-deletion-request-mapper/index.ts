import type { AccountDeletionRequest } from '@/modules/accounts/domain/entities/account-deletion-request/index.js'
import type { AccountDeletionRequestRow } from '@/modules/accounts/infrastructure/clients/accounts-prisma-client/index.js'

export class AccountDeletionRequestMapper {
  toPersistence(request: AccountDeletionRequest): AccountDeletionRequestRow {
    return {
      id: request.id,
      accountId: request.accountId,
      requestedAt: request.requestedAt,
      scheduledFor: request.scheduledFor,
    }
  }
}
