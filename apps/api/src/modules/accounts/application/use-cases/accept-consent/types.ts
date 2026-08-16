import type { VerifiedAuthIdentity } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

export interface AcceptConsentInput {
  readonly identity?: VerifiedAuthIdentity
  readonly accessToken?: string
}

export interface AcceptConsentOutput {
  readonly acceptedAt: string
  readonly purpose: 'voice_recording_and_analysis'
  readonly version: string
}
