import type { AccountDeletionRequest } from '@/modules/accounts/domain/entities/account-deletion-request/index.js'

export interface AccountDeletionRequestsRepository {
  save(request: AccountDeletionRequest): Promise<void>
}
