import type { VerifiedAuthIdentity } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

export interface UpdateAccountNameInput {
  readonly identity?: VerifiedAuthIdentity
  readonly accessToken?: string
  readonly name: string
}

export interface UpdateAccountNameOutput {
  readonly name: string
}
