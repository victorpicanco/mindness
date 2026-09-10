import type { VerifiedAuthIdentity } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

export interface GetAccountProfileInput {
  readonly identity?: VerifiedAuthIdentity
  readonly accessToken?: string
}

export interface AccountConsentView {
  readonly purpose: 'voice_recording_and_analysis'
  readonly version: string
  readonly acceptedAt: string
}

interface AccountProfileFields {
  readonly accountId: string
  readonly name: string | null
  readonly createdAt: string
  readonly timeZone: string
  readonly plan: 'free'
  readonly consent: AccountConsentView | null
}

export type GetAccountProfileOutput = AccountProfileFields &
  (
    | {
        readonly accountKind: 'guest'
        readonly authenticationMethod: 'anonymous'
        readonly email: null
      }
    | {
        readonly accountKind: 'registered'
        readonly authenticationMethod: 'password' | 'google'
        readonly email: string
      }
  )
