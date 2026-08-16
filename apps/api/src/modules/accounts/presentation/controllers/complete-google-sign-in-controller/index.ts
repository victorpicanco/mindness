import type { FastifyReply, FastifyRequest } from 'fastify'

import type { CompleteGoogleSignInUseCase } from '@/modules/accounts/application/use-cases/complete-google-sign-in/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import { GOOGLE_PKCE_COOKIE } from '../start-google-sign-in-controller/schemas.js'

import type { GoogleCallbackQuery } from './schemas.js'

export class CompleteGoogleSignInController {
  constructor(
    private readonly useCase: CompleteGoogleSignInUseCase,
    private readonly callbackPath: string,
  ) {}

  async handle(
    request: FastifyRequest<{ Querystring: GoogleCallbackQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const pkceState = request.cookies[GOOGLE_PKCE_COOKIE]
    // FastifyReply is thenable and only settles once the response is sent, so awaiting a cookie
    // mutation deadlocks the handler before send(). The pkce state is single use: it is cleared
    // here, ahead of the exchange, so a rejected callback also drops it.
    void reply.clearCookie(GOOGLE_PKCE_COOKIE, { path: this.callbackPath })
    const output = await this.useCase.execute({
      code: 'code' in request.query ? request.query.code : null,
      error: 'error' in request.query ? request.query.error : null,
      pkceState: pkceState ?? null,
    })

    await reply.code(200).send(ok(output))
  }
}
