import type { FastifyReply, FastifyRequest } from 'fastify'

import type { CompleteGoogleSignInUseCase } from '@/modules/accounts/application/use-cases/complete-google-sign-in/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import { GOOGLE_PKCE_COOKIE } from '../start-google-sign-in-controller/schemas.js'

import type { GoogleCallbackQuery } from './schemas.js'

export class CompleteGoogleSignInController {
  constructor(private readonly useCase: CompleteGoogleSignInUseCase) {}

  async handle(
    request: FastifyRequest<{ Querystring: GoogleCallbackQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const pkceState = request.cookies[GOOGLE_PKCE_COOKIE]
    const output = await this.useCase.execute({
      code: request.query.code,
      pkceState: pkceState ?? null,
    })

    await reply.clearCookie(GOOGLE_PKCE_COOKIE).code(200).send(ok(output))
  }
}
