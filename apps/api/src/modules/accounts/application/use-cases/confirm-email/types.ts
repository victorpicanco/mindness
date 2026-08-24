import type { EmailOtpVerificationType } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

export interface ConfirmEmailInput {
  readonly tokenHash: string
  readonly type: EmailOtpVerificationType
}

export interface ConfirmEmailOutput {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: string
}
