import type { VerifiedAuthIdentity } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

export interface DeleteAccountInput {
  readonly accessToken: string
  readonly identity?: VerifiedAuthIdentity
}

export interface DeleteAccountOutput {
  readonly scheduledFor: string
}
