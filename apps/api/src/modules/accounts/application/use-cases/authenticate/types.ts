import type { VerifiedAuthIdentity } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

export interface AuthenticateInput {
  readonly accessToken: string
}

export type AuthenticateOutput = VerifiedAuthIdentity & {
  readonly accountId: string | null
}
