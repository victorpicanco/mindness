import type { AccountsPort } from '@/modules/quota/domain/ports/accounts-port/index.js'
import type { QuotaAccount } from '@/modules/quota/domain/ports/accounts-port/types.js'

export interface FakeAccountsPort extends AccountsPort {
  registerAccount(account: QuotaAccount): void
  reset(): void
}

export function createFakeAccountsPort(): FakeAccountsPort {
  const accounts = new Map<string, QuotaAccount>()

  return {
    findAccount: (accountId) => Promise.resolve(accounts.get(accountId) ?? null),
    registerAccount: (account) => {
      accounts.set(account.accountId, account)
    },
    reset: () => {
      accounts.clear()
    },
  }
}
