import type { FastifyReply, FastifyRequest } from 'fastify'

import type { StartGoogleSignInUseCase } from '@/modules/accounts/application/use-cases/start-google-sign-in/index.js'

import { GOOGLE_PKCE_COOKIE, GOOGLE_PKCE_COOKIE_MAX_AGE_SECONDS } from './schemas.js'

export interface StartGoogleSignInControllerOptions {
  readonly secureCookie: boolean
  readonly callbackPath: string
}

export class StartGoogleSignInController {
  constructor(
    private readonly useCase: StartGoogleSignInUseCase,
    private readonly options: StartGoogleSignInControllerOptions,
  ) {}

  async handle(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const output = await this.useCase.execute()

    await reply
      .setCookie(GOOGLE_PKCE_COOKIE, output.pkceState, {
        httpOnly: true,
        secure: this.options.secureCookie,
        sameSite: 'lax',
        path: this.options.callbackPath,
        maxAge: GOOGLE_PKCE_COOKIE_MAX_AGE_SECONDS,
      })
      .redirect(output.authorizationUrl, 302)
  }
}
