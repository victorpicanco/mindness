import { AcceptConsentUseCase } from '@/modules/accounts/application/use-cases/accept-consent/index.js'
import { AuthenticateUseCase } from '@/modules/accounts/application/use-cases/authenticate/index.js'
import { CheckPracticeEligibilityUseCase } from '@/modules/accounts/application/use-cases/check-practice-eligibility/index.js'
import { ConfirmEmailUseCase } from '@/modules/accounts/application/use-cases/confirm-email/index.js'
import { CompleteGoogleSignInUseCase } from '@/modules/accounts/application/use-cases/complete-google-sign-in/index.js'
import { CreateAccountUseCase } from '@/modules/accounts/application/use-cases/create-account/index.js'
import { DeleteAccountUseCase } from '@/modules/accounts/application/use-cases/delete-account/index.js'
import { GetAccountProfileUseCase } from '@/modules/accounts/application/use-cases/get-account-profile/index.js'
import { GetAccountSnapshotUseCase } from '@/modules/accounts/application/use-cases/get-account-snapshot/index.js'
import { SignInUseCase } from '@/modules/accounts/application/use-cases/sign-in/index.js'
import { RefreshSessionUseCase } from '@/modules/accounts/application/use-cases/refresh-session/index.js'
import { RequestPasswordRecoveryUseCase } from '@/modules/accounts/application/use-cases/request-password-recovery/index.js'
import { ResendSignUpConfirmationUseCase } from '@/modules/accounts/application/use-cases/resend-sign-up-confirmation/index.js'
import { SignOutUseCase } from '@/modules/accounts/application/use-cases/sign-out/index.js'
import { SignUpUseCase } from '@/modules/accounts/application/use-cases/sign-up/index.js'
import { StartGoogleSignInUseCase } from '@/modules/accounts/application/use-cases/start-google-sign-in/index.js'
import { UpdateTimeZoneUseCase } from '@/modules/accounts/application/use-cases/update-time-zone/index.js'
import { UpdatePasswordUseCase } from '@/modules/accounts/application/use-cases/update-password/index.js'
import type { AuthIdentityProvider } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { Clock } from '@/modules/accounts/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/accounts/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/accounts/domain/ports/id-generator/index.js'
import type { SubscriptionCancellation } from '@/modules/accounts/domain/ports/subscription-cancellation/index.js'
import type { UnitOfWork } from '@/modules/accounts/domain/ports/unit-of-work/index.js'
import { NoOpSubscriptionCancellationAdapter } from '@/modules/accounts/infrastructure/adapters/no-op-subscription-cancellation-adapter/index.js'
import { PrismaUnitOfWorkAdapter } from '@/modules/accounts/infrastructure/adapters/prisma-unit-of-work-adapter/index.js'
import { SupabaseAuthIdentityProviderAdapter } from '@/modules/accounts/infrastructure/adapters/supabase-auth-identity-provider-adapter/index.js'
import type {
  AccountsPrismaClient,
  AccountsPrismaTransactionRunner,
} from '@/modules/accounts/infrastructure/clients/accounts-prisma-client/index.js'
import { AccountsTransactionContext } from '@/modules/accounts/infrastructure/clients/accounts-transaction-context/index.js'
import { SupabaseAuthApiClient } from '@/modules/accounts/infrastructure/clients/supabase-auth-api/index.js'
import { AccountDeletionRequestMapper } from '@/modules/accounts/infrastructure/mappers/account-deletion-request-mapper/index.js'
import { AccountMapper } from '@/modules/accounts/infrastructure/mappers/account-mapper/index.js'
import { PrismaAccountDeletionRequestsRepository } from '@/modules/accounts/infrastructure/repositories/prisma-account-deletion-requests-repository/index.js'
import { PrismaAccountsRepository } from '@/modules/accounts/infrastructure/repositories/prisma-accounts-repository/index.js'
import { AcceptConsentController } from '@/modules/accounts/presentation/controllers/accept-consent-controller/index.js'
import { CompleteGoogleSignInController } from '@/modules/accounts/presentation/controllers/complete-google-sign-in-controller/index.js'
import { ConfirmEmailController } from '@/modules/accounts/presentation/controllers/confirm-email-controller/index.js'
import { CreateAccountController } from '@/modules/accounts/presentation/controllers/create-account-controller/index.js'
import { DeleteAccountController } from '@/modules/accounts/presentation/controllers/delete-account-controller/index.js'
import { GetAccountProfileController } from '@/modules/accounts/presentation/controllers/get-account-profile-controller/index.js'
import { SignInController } from '@/modules/accounts/presentation/controllers/sign-in-controller/index.js'
import { RefreshSessionController } from '@/modules/accounts/presentation/controllers/refresh-session-controller/index.js'
import { RequestPasswordRecoveryController } from '@/modules/accounts/presentation/controllers/request-password-recovery-controller/index.js'
import { ResendSignUpConfirmationController } from '@/modules/accounts/presentation/controllers/resend-sign-up-confirmation-controller/index.js'
import { SignOutController } from '@/modules/accounts/presentation/controllers/sign-out-controller/index.js'
import { SignUpController } from '@/modules/accounts/presentation/controllers/sign-up-controller/index.js'
import { StartGoogleSignInController } from '@/modules/accounts/presentation/controllers/start-google-sign-in-controller/index.js'
import { UpdateTimeZoneController } from '@/modules/accounts/presentation/controllers/update-time-zone-controller/index.js'
import { UpdatePasswordController } from '@/modules/accounts/presentation/controllers/update-password-controller/index.js'
import type { AuthRateLimitOptions } from '@/modules/accounts/presentation/middleware/auth-rate-limit/index.js'
import { ACCOUNTS_ROUTE_PATHS } from '@/modules/accounts/presentation/routes/accounts-routes/types.js'
import type { AccountsControllers } from '@/modules/accounts/presentation/routes/accounts-routes/types.js'

import { createAccountsFacade, type AccountsFacade } from './facade.js'

export interface AccountsConfig {
  readonly consentVersion: string
  readonly publicApiUrl: string
  readonly publicWebUrl: string
  readonly secureCookies: boolean
  readonly supabaseUrl: string
  readonly supabaseSecretKey: string
  readonly emailConfirmationRedirectUrl: string
  readonly authRateLimit: AuthRateLimitOptions
}

export interface AccountsAdapterOverrides {
  readonly authIdentityProvider?: AuthIdentityProvider
  readonly subscriptionCancellation?: SubscriptionCancellation
  readonly unitOfWork?: UnitOfWork
}

export interface AccountsModuleDeps {
  readonly prisma: AccountsPrismaClient & AccountsPrismaTransactionRunner
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly config: AccountsConfig
  readonly adapters?: AccountsAdapterOverrides
}

export function createAccountsContainer(deps: AccountsModuleDeps) {
  const transactionContext = new AccountsTransactionContext()
  const { clock, idGenerator } = deps
  const unitOfWork =
    deps.adapters?.unitOfWork ?? new PrismaUnitOfWorkAdapter(deps.prisma, transactionContext)
  const authIdentityProvider =
    deps.adapters?.authIdentityProvider ??
    new SupabaseAuthIdentityProviderAdapter(
      new SupabaseAuthApiClient({
        url: deps.config.supabaseUrl,
        secretKey: deps.config.supabaseSecretKey,
        emailRedirectUrl: deps.config.emailConfirmationRedirectUrl,
      }),
    )
  const subscriptionCancellation =
    deps.adapters?.subscriptionCancellation ?? new NoOpSubscriptionCancellationAdapter()

  const accounts = new PrismaAccountsRepository(
    deps.prisma,
    transactionContext,
    new AccountMapper(),
  )
  const deletionRequests = new PrismaAccountDeletionRequestsRepository(
    deps.prisma,
    transactionContext,
    new AccountDeletionRequestMapper(),
  )

  const shared = {
    accounts,
    authIdentityProvider,
    clock,
    eventPublisher: deps.eventPublisher,
    idGenerator,
    unitOfWork,
  }

  const useCases = {
    acceptConsent: new AcceptConsentUseCase({
      ...shared,
      consentVersion: deps.config.consentVersion,
    }),
    authenticate: new AuthenticateUseCase({ accounts, authIdentityProvider }),
    checkPracticeEligibility: new CheckPracticeEligibilityUseCase(accounts),
    confirmEmail: new ConfirmEmailUseCase({ authIdentityProvider }),
    completeGoogleSignIn: new CompleteGoogleSignInUseCase(shared),
    createAccount: new CreateAccountUseCase(shared),
    deleteAccount: new DeleteAccountUseCase({
      ...shared,
      deletionRequests,
      subscriptionCancellation,
    }),
    getAccountProfile: new GetAccountProfileUseCase({ accounts, authIdentityProvider }),
    getAccountSnapshot: new GetAccountSnapshotUseCase(accounts),
    signIn: new SignInUseCase(shared),
    refreshSession: new RefreshSessionUseCase({ authIdentityProvider }),
    requestPasswordRecovery: new RequestPasswordRecoveryUseCase({ authIdentityProvider }),
    resendSignUpConfirmation: new ResendSignUpConfirmationUseCase({ authIdentityProvider }),
    signOut: new SignOutUseCase({ authIdentityProvider }),
    signUp: new SignUpUseCase({ authIdentityProvider }),
    startGoogleSignIn: new StartGoogleSignInUseCase({
      authIdentityProvider,
      googleCallbackUrl: `${deps.config.publicApiUrl}${ACCOUNTS_ROUTE_PATHS.googleCallback}`,
    }),
    updateTimeZone: new UpdateTimeZoneUseCase(shared),
    updatePassword: new UpdatePasswordUseCase({ authIdentityProvider }),
  }

  const controllers: AccountsControllers = {
    acceptConsent: new AcceptConsentController(useCases.acceptConsent),
    completeGoogleSignIn: new CompleteGoogleSignInController(useCases.completeGoogleSignIn, {
      callbackPath: ACCOUNTS_ROUTE_PATHS.googleCallback,
      webCallbackUrl: `${deps.config.publicWebUrl}/auth/callback`,
      webSignInUrl: `${deps.config.publicWebUrl}/auth/sign-in`,
    }),
    confirmEmail: new ConfirmEmailController(useCases.confirmEmail),
    createAccount: new CreateAccountController(useCases.createAccount),
    deleteAccount: new DeleteAccountController(useCases.deleteAccount),
    getAccountProfile: new GetAccountProfileController(useCases.getAccountProfile),
    signIn: new SignInController(useCases.signIn),
    refreshSession: new RefreshSessionController(useCases.refreshSession),
    requestPasswordRecovery: new RequestPasswordRecoveryController(
      useCases.requestPasswordRecovery,
    ),
    resendSignUpConfirmation: new ResendSignUpConfirmationController(
      useCases.resendSignUpConfirmation,
    ),
    signOut: new SignOutController(useCases.signOut),
    signUp: new SignUpController(useCases.signUp),
    startGoogleSignIn: new StartGoogleSignInController(useCases.startGoogleSignIn, {
      secureCookie: deps.config.secureCookies,
      callbackPath: ACCOUNTS_ROUTE_PATHS.googleCallback,
    }),
    updateTimeZone: new UpdateTimeZoneController(useCases.updateTimeZone),
    updatePassword: new UpdatePasswordController(useCases.updatePassword),
  }

  const facade: AccountsFacade = createAccountsFacade({
    checkPracticeEligibility: useCases.checkPracticeEligibility,
    getAccountSnapshot: useCases.getAccountSnapshot,
    authenticate: useCases.authenticate,
  })

  return { controllers, facade, repositories: { accounts, deletionRequests }, useCases }
}

export type AccountsContainer = ReturnType<typeof createAccountsContainer>
