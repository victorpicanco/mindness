import type { AuthenticateUseCase } from '@/modules/accounts/application/use-cases/authenticate/index.js'
import type { CheckPracticeEligibilityUseCase } from '@/modules/accounts/application/use-cases/check-practice-eligibility/index.js'
import type {
  AccountSnapshot,
  GetAccountSnapshotUseCase,
} from '@/modules/accounts/application/use-cases/get-account-snapshot/index.js'

export interface AccountsFacade {
  canStartPractice(accountId: string): Promise<boolean>
  getAccountSnapshot(accountId: string): Promise<AccountSnapshot | null>
  authenticate(accessToken: string): Promise<{ accountId: string | null }>
}

export function createAccountsFacade(dependencies: {
  readonly checkPracticeEligibility: CheckPracticeEligibilityUseCase
  readonly getAccountSnapshot: GetAccountSnapshotUseCase
  readonly authenticate: AuthenticateUseCase
}): AccountsFacade {
  return {
    canStartPractice: async (accountId) => {
      const result = await dependencies.checkPracticeEligibility.execute({ accountId })
      return result.eligible
    },
    getAccountSnapshot: (accountId) => dependencies.getAccountSnapshot.execute({ accountId }),
    authenticate: async (accessToken) => {
      const identity = await dependencies.authenticate.execute({ accessToken })
      return { accountId: identity.accountId }
    },
  }
}
