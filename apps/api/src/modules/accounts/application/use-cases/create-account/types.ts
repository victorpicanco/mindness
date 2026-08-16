import type { VerifiedAuthIdentity } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

export interface CreateAccountInput {
  readonly identity?: VerifiedAuthIdentity
  readonly accessToken?: string
  readonly timeZone: string | null
}

export interface CreateAccountOutput {
  readonly message: string
}
