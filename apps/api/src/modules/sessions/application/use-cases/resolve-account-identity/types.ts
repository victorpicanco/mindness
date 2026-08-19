import type { AccountsPort } from '@/modules/sessions/domain/ports/accounts-port/index.js'

export interface ResolveAccountIdentityInput {
  readonly accessToken: string
}

export interface ResolveAccountIdentityOutput {
  readonly accountId: string | null
}

export interface ResolveAccountIdentityDependencies {
  readonly accounts: AccountsPort
}
