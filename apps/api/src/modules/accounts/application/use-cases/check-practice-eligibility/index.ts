import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'

import type { CheckPracticeEligibilityInput, CheckPracticeEligibilityOutput } from './types.js'

export class CheckPracticeEligibilityUseCase {
  constructor(private readonly accounts: AccountsRepository) {}

  async execute(input: CheckPracticeEligibilityInput): Promise<CheckPracticeEligibilityOutput> {
    const account = await this.accounts.findById(input.accountId)

    return { eligible: account?.canStartPractice() ?? false }
  }
}
