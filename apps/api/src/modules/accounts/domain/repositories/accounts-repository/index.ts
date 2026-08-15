import type { Account } from '../../entities/account/index.js'

export interface AccountsRepository {
  findByAuthUserId(authUserId: string): Promise<Account | null>
  save(account: Account): Promise<void>
}
