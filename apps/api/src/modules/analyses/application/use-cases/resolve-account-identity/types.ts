import type { AccountsPort } from '@/modules/analyses/domain/ports/accounts-port/index.js'

export interface ResolveAccountIdentityInput {
  readonly accessToken: string
}

export interface ResolveAccountIdentityOutput {
  readonly accountId: string | null
}

export interface ResolveAccountIdentityDependencies {
  readonly accounts: Pick<AccountsPort, 'resolveAccountId'>
}
