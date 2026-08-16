import type { Account } from '@/modules/accounts/domain/entities/account/index.js'

export interface AccountsRepository {
  count(): Promise<number>
  findById(accountId: string): Promise<Account | null>
  findByAuthUserId(authUserId: string): Promise<Account | null>
  findByEmail(email: string): Promise<Account | null>
  save(account: Account): Promise<void>
}
