import type { AcceptConsentController } from '@/modules/accounts/presentation/controllers/accept-consent-controller/index.js'
import type { CompleteGoogleSignInController } from '@/modules/accounts/presentation/controllers/complete-google-sign-in-controller/index.js'
import type { ConfirmEmailController } from '@/modules/accounts/presentation/controllers/confirm-email-controller/index.js'
import type { CreateAccountController } from '@/modules/accounts/presentation/controllers/create-account-controller/index.js'
import type { DeleteAccountController } from '@/modules/accounts/presentation/controllers/delete-account-controller/index.js'
import type { GetAccountProfileController } from '@/modules/accounts/presentation/controllers/get-account-profile-controller/index.js'
import type { SignInController } from '@/modules/accounts/presentation/controllers/sign-in-controller/index.js'
import type { RefreshSessionController } from '@/modules/accounts/presentation/controllers/refresh-session-controller/index.js'
import type { RequestPasswordRecoveryController } from '@/modules/accounts/presentation/controllers/request-password-recovery-controller/index.js'
import type { ResendSignUpConfirmationController } from '@/modules/accounts/presentation/controllers/resend-sign-up-confirmation-controller/index.js'
import type { SignOutController } from '@/modules/accounts/presentation/controllers/sign-out-controller/index.js'
import type { SignUpController } from '@/modules/accounts/presentation/controllers/sign-up-controller/index.js'
import type { StartGoogleSignInController } from '@/modules/accounts/presentation/controllers/start-google-sign-in-controller/index.js'
import type { UpdateTimeZoneController } from '@/modules/accounts/presentation/controllers/update-time-zone-controller/index.js'
import type { UpdatePasswordController } from '@/modules/accounts/presentation/controllers/update-password-controller/index.js'

export interface AccountsControllers {
  readonly acceptConsent: AcceptConsentController
  readonly completeGoogleSignIn: CompleteGoogleSignInController
  readonly confirmEmail: ConfirmEmailController
  readonly createAccount: CreateAccountController
  readonly deleteAccount: DeleteAccountController
  readonly getAccountProfile: GetAccountProfileController
  readonly signIn: SignInController
  readonly refreshSession: RefreshSessionController
  readonly requestPasswordRecovery: RequestPasswordRecoveryController
  readonly resendSignUpConfirmation: ResendSignUpConfirmationController
  readonly signOut: SignOutController
  readonly signUp: SignUpController
  readonly startGoogleSignIn: StartGoogleSignInController
  readonly updateTimeZone: UpdateTimeZoneController
  readonly updatePassword: UpdatePasswordController
}

export const ACCOUNTS_ROUTE_PATHS = {
  signUp: '/auth/sign-up',
  signIn: '/auth/sign-in',
  refresh: '/auth/refresh',
  confirmEmail: '/auth/email/confirm',
  resendSignUpConfirmation: '/auth/email/resend',
  requestPasswordRecovery: '/auth/password/recovery',
  updatePassword: '/auth/password',
  signOut: '/auth/sign-out',
  googleStart: '/auth/google',
  googleCallback: '/auth/google/callback',
  account: '/accounts',
  profile: '/accounts/me',
  consent: '/accounts/me/consent',
  timeZone: '/accounts/me/time-zone',
} as const
