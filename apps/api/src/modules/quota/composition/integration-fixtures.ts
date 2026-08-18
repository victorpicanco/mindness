import type { AccountsPort } from '@/modules/quota/domain/ports/accounts-port/index.js'
import type { QuotaAccount } from '@/modules/quota/domain/ports/accounts-port/types.js'
import type { PrismaClient } from '@/generated/prisma/client.js'

const QUOTA_TABLES = ['quota_reservations', 'quota_cycles']

export interface QuotaAccountFixtureOverrides {
  readonly accountId?: string
  readonly plan?: QuotaAccount['plan']
  readonly createdAt?: Date
}

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

export function clearQuotaData(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${QUOTA_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  )
}

export function createQuotaAccountFixture(
  overrides: QuotaAccountFixtureOverrides = {},
): QuotaAccount {
  return {
    accountId: overrides.accountId ?? '00000000-0000-4000-8000-000000000001',
    plan: overrides.plan ?? 'free',
    createdAt: overrides.createdAt ?? new Date('2026-08-16T12:00:00.000Z'),
  }
}
