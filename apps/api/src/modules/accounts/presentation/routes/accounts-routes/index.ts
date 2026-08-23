import fastifyCookie from '@fastify/cookie'
import { type TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'

import type { AuthenticateUseCase } from '@/modules/accounts/application/use-cases/authenticate/index.js'
import { AcceptConsentResponseSchema } from '@/modules/accounts/presentation/controllers/accept-consent-controller/schemas.js'
import {
  GoogleCallbackQuerySchema,
  type GoogleCallbackQuery,
} from '@/modules/accounts/presentation/controllers/complete-google-sign-in-controller/schemas.js'
import {
  CreateAccountBodySchema,
  CreateAccountResponseSchema,
  type CreateAccountBody,
} from '@/modules/accounts/presentation/controllers/create-account-controller/schemas.js'
import { DeleteAccountResponseSchema } from '@/modules/accounts/presentation/controllers/delete-account-controller/schemas.js'
import { AccountProfileResponseSchema } from '@/modules/accounts/presentation/controllers/get-account-profile-controller/schemas.js'
import {
  SessionResponseSchema,
  SignInBodySchema,
  type SignInBody,
} from '@/modules/accounts/presentation/controllers/sign-in-controller/schemas.js'
import {
  RefreshSessionBodySchema,
  type RefreshSessionBody,
} from '@/modules/accounts/presentation/controllers/refresh-session-controller/schemas.js'
import {
  SignUpBodySchema,
  SignUpResponseSchema,
  type SignUpBody,
} from '@/modules/accounts/presentation/controllers/sign-up-controller/schemas.js'
import {
  UpdateTimeZoneBodySchema,
  UpdateTimeZoneResponseSchema,
  type UpdateTimeZoneBody,
} from '@/modules/accounts/presentation/controllers/update-time-zone-controller/schemas.js'
import { registerAccountsErrorHandler } from '@/modules/accounts/presentation/error-handler/index.js'
import { registerAuthenticatedIdentity } from '@/modules/accounts/presentation/middleware/authenticated-identity/index.js'
import { ErrorResponseSchema } from '@/shared/http/envelope/index.js'

import { ACCOUNTS_ROUTE_PATHS, type AccountsControllers } from './types.js'

const ERROR_RESPONSES = {
  400: ErrorResponseSchema,
  401: ErrorResponseSchema,
  404: ErrorResponseSchema,
  409: ErrorResponseSchema,
  422: ErrorResponseSchema,
  500: ErrorResponseSchema,
}

export interface AccountsRoutesDeps {
  readonly controllers: AccountsControllers
  readonly authenticate: AuthenticateUseCase
}

export async function registerAccountsRoutes(
  app: FastifyInstance,
  deps: AccountsRoutesDeps,
): Promise<void> {
  const { controllers } = deps

  await app.register(fastifyCookie)
  registerAccountsErrorHandler(app)

  const publicRoutes = app.withTypeProvider<TypeBoxTypeProvider>()

  publicRoutes.post<{ Body: SignUpBody }>(
    ACCOUNTS_ROUTE_PATHS.signUp,
    {
      schema: {
        body: SignUpBodySchema,
        response: { 202: SignUpResponseSchema, ...ERROR_RESPONSES },
      },
    },
    (request, reply) => controllers.signUp.handle(request, reply),
  )

  publicRoutes.post<{ Body: SignInBody }>(
    ACCOUNTS_ROUTE_PATHS.signIn,
    {
      schema: {
        body: SignInBodySchema,
        response: { 200: SessionResponseSchema, ...ERROR_RESPONSES },
      },
    },
    (request, reply) => controllers.signIn.handle(request, reply),
  )

  publicRoutes.post<{ Body: RefreshSessionBody }>(
    ACCOUNTS_ROUTE_PATHS.refresh,
    {
      schema: {
        body: RefreshSessionBodySchema,
        response: { 200: SessionResponseSchema, ...ERROR_RESPONSES },
      },
    },
    (request, reply) => controllers.refreshSession.handle(request, reply),
  )

  publicRoutes.get(
    ACCOUNTS_ROUTE_PATHS.googleStart,
    { schema: { response: ERROR_RESPONSES } },
    (request, reply) => controllers.startGoogleSignIn.handle(request, reply),
  )

  publicRoutes.get<{ Querystring: GoogleCallbackQuery }>(
    ACCOUNTS_ROUTE_PATHS.googleCallback,
    {
      schema: {
        querystring: GoogleCallbackQuerySchema,
        response: { 200: SessionResponseSchema, ...ERROR_RESPONSES },
      },
    },
    (request, reply) => controllers.completeGoogleSignIn.handle(request, reply),
  )

  await app.register((scope, _options, done) => {
    registerAuthenticatedIdentity(scope, deps.authenticate)
    const authenticated = scope.withTypeProvider<TypeBoxTypeProvider>()

    authenticated.post<{ Body: CreateAccountBody }>(
      ACCOUNTS_ROUTE_PATHS.account,
      {
        schema: {
          body: CreateAccountBodySchema,
          response: { 200: CreateAccountResponseSchema, ...ERROR_RESPONSES },
        },
      },
      (request, reply) => controllers.createAccount.handle(request, reply),
    )

    authenticated.get(
      ACCOUNTS_ROUTE_PATHS.profile,
      { schema: { response: { 200: AccountProfileResponseSchema, ...ERROR_RESPONSES } } },
      (request, reply) => controllers.getAccountProfile.handle(request, reply),
    )

    authenticated.post(
      ACCOUNTS_ROUTE_PATHS.consent,
      { schema: { response: { 200: AcceptConsentResponseSchema, ...ERROR_RESPONSES } } },
      (request, reply) => controllers.acceptConsent.handle(request, reply),
    )

    authenticated.patch<{ Body: UpdateTimeZoneBody }>(
      ACCOUNTS_ROUTE_PATHS.timeZone,
      {
        schema: {
          body: UpdateTimeZoneBodySchema,
          response: { 200: UpdateTimeZoneResponseSchema, ...ERROR_RESPONSES },
        },
      },
      (request, reply) => controllers.updateTimeZone.handle(request, reply),
    )

    authenticated.delete(
      ACCOUNTS_ROUTE_PATHS.profile,
      { schema: { response: { 200: DeleteAccountResponseSchema, ...ERROR_RESPONSES } } },
      (request, reply) => controllers.deleteAccount.handle(request, reply),
    )

    done()
  })
}
