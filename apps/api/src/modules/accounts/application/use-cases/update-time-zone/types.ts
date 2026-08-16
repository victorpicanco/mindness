import type { VerifiedAuthIdentity } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

export interface UpdateTimeZoneInput {
  readonly identity?: VerifiedAuthIdentity
  readonly accessToken?: string
  readonly timeZone: string
}

export interface UpdateTimeZoneOutput {
  readonly timeZone: string
}
