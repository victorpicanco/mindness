import type { FastifyReply, FastifyRequest } from 'fastify'

import type { CompleteGoogleSignInUseCase } from '@/modules/accounts/application/use-cases/complete-google-sign-in/index.js'

import { GOOGLE_PKCE_COOKIE } from '../start-google-sign-in-controller/schemas.js'

import type { GoogleCallbackQuery } from './schemas.js'

export class CompleteGoogleSignInController {
  constructor(
    private readonly useCase: CompleteGoogleSignInUseCase,
    private readonly callbackPath: string,
    private readonly webCallbackUrl: string,
  ) {}

  async handle(
    request: FastifyRequest<{ Querystring: GoogleCallbackQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const pkceState = request.cookies[GOOGLE_PKCE_COOKIE]
    void reply.clearCookie(GOOGLE_PKCE_COOKIE, { path: this.callbackPath })
    const output = await this.useCase.execute({
      code: 'code' in request.query ? request.query.code : null,
      error: 'error' in request.query ? request.query.error : null,
      pkceState: pkceState ?? null,
    })

    const redirectUrl = new URL(this.webCallbackUrl)
    redirectUrl.searchParams.set('access_token', output.accessToken)
    redirectUrl.searchParams.set('refresh_token', output.refreshToken)

    await reply.redirect(redirectUrl.toString())
  }
}
