import type { FastifyReply, FastifyRequest } from 'fastify'

import type { CompleteGoogleSignInUseCase } from '@/modules/accounts/application/use-cases/complete-google-sign-in/index.js'
import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'

import { GOOGLE_PKCE_COOKIE } from '../start-google-sign-in-controller/schemas.js'

import type { GoogleCallbackQuery } from './schemas.js'

export interface CompleteGoogleSignInControllerOptions {
  readonly callbackPath: string
  readonly webCallbackUrl: string
  readonly webSignInUrl: string
}

const GOOGLE_CALLBACK_FAILED = 'google_callback_failed'

export class CompleteGoogleSignInController {
  constructor(
    private readonly useCase: CompleteGoogleSignInUseCase,
    private readonly options: CompleteGoogleSignInControllerOptions,
  ) {}

  async handle(
    request: FastifyRequest<{ Querystring: GoogleCallbackQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const pkceState = request.cookies[GOOGLE_PKCE_COOKIE]
    void reply.clearCookie(GOOGLE_PKCE_COOKIE, { path: this.options.callbackPath })

    try {
      const output = await this.useCase.execute({
        code: 'code' in request.query ? request.query.code : null,
        error: 'error' in request.query ? request.query.error : null,
        pkceState: pkceState ?? null,
      })

      const redirectUrl = new URL(this.options.webCallbackUrl)
      redirectUrl.searchParams.set('access_token', output.accessToken)
      redirectUrl.searchParams.set('refresh_token', output.refreshToken)

      await reply.redirect(redirectUrl.toString())
    } catch (error) {
      if (!(error instanceof AuthenticationRejectedError)) throw error

      const signInUrl = new URL(this.options.webSignInUrl)
      signInUrl.searchParams.set('error', GOOGLE_CALLBACK_FAILED)

      await reply.redirect(signInUrl.toString())
    }
  }
}
