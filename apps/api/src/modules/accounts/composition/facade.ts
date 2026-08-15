import type { CheckPracticeEligibilityUseCase } from '@/modules/accounts/application/use-cases/check-practice-eligibility/index.js'

export interface AccountsFacade {
  canStartPractice(accountId: string): Promise<boolean>
}

export function createAccountsFacade(
  checkPracticeEligibility: CheckPracticeEligibilityUseCase,
): AccountsFacade {
  return {
    canStartPractice: async (accountId) => {
      const result = await checkPracticeEligibility.execute({ accountId })
      return result.eligible
    },
  }
}
