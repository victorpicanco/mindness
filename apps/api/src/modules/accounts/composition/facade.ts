import type { CheckPracticeEligibilityUseCase } from '@/modules/accounts/application/use-cases/check-practice-eligibility/index.js'
import type {
  AccountSnapshot,
  GetAccountSnapshotUseCase,
} from '@/modules/accounts/application/use-cases/get-account-snapshot/index.js'

export interface AccountsFacade {
  canStartPractice(accountId: string): Promise<boolean>
  getAccountSnapshot(accountId: string): Promise<AccountSnapshot | null>
}

export function createAccountsFacade(
  checkPracticeEligibility: CheckPracticeEligibilityUseCase,
  getAccountSnapshot: GetAccountSnapshotUseCase,
): AccountsFacade {
  return {
    canStartPractice: async (accountId) => {
      const result = await checkPracticeEligibility.execute({ accountId })
      return result.eligible
    },
    getAccountSnapshot: (accountId) => getAccountSnapshot.execute({ accountId }),
  }
}
