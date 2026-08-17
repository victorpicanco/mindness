import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'

import type { GetAccountSnapshotInput, GetAccountSnapshotOutput } from './types.js'

export class GetAccountSnapshotUseCase {
  constructor(private readonly accounts: AccountsRepository) {}

  async execute(input: GetAccountSnapshotInput): Promise<GetAccountSnapshotOutput> {
    const account = await this.accounts.findById(input.accountId)

    if (account === null) return null

    return { accountId: account.id, plan: account.plan, createdAt: account.createdAt }
  }
}

export type { AccountSnapshot, GetAccountSnapshotInput, GetAccountSnapshotOutput } from './types.js'
