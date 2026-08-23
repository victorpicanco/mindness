import type { AcceptConsentController } from '@/modules/accounts/presentation/controllers/accept-consent-controller/index.js'
import type { CompleteGoogleSignInController } from '@/modules/accounts/presentation/controllers/complete-google-sign-in-controller/index.js'
import type { CreateAccountController } from '@/modules/accounts/presentation/controllers/create-account-controller/index.js'
import type { DeleteAccountController } from '@/modules/accounts/presentation/controllers/delete-account-controller/index.js'
import type { GetAccountProfileController } from '@/modules/accounts/presentation/controllers/get-account-profile-controller/index.js'
import type { SignInController } from '@/modules/accounts/presentation/controllers/sign-in-controller/index.js'
import type { RefreshSessionController } from '@/modules/accounts/presentation/controllers/refresh-session-controller/index.js'
import type { SignUpController } from '@/modules/accounts/presentation/controllers/sign-up-controller/index.js'
import type { StartGoogleSignInController } from '@/modules/accounts/presentation/controllers/start-google-sign-in-controller/index.js'
import type { UpdateTimeZoneController } from '@/modules/accounts/presentation/controllers/update-time-zone-controller/index.js'

export interface AccountsControllers {
  readonly acceptConsent: AcceptConsentController
  readonly completeGoogleSignIn: CompleteGoogleSignInController
  readonly createAccount: CreateAccountController
  readonly deleteAccount: DeleteAccountController
  readonly getAccountProfile: GetAccountProfileController
  readonly signIn: SignInController
  readonly refreshSession: RefreshSessionController
  readonly signUp: SignUpController
  readonly startGoogleSignIn: StartGoogleSignInController
  readonly updateTimeZone: UpdateTimeZoneController
}

export const ACCOUNTS_ROUTE_PATHS = {
  signUp: '/auth/sign-up',
  signIn: '/auth/sign-in',
  refresh: '/auth/refresh',
  googleStart: '/auth/google',
  googleCallback: '/auth/google/callback',
  account: '/accounts',
  profile: '/accounts/me',
  consent: '/accounts/me/consent',
  timeZone: '/accounts/me/time-zone',
} as const
