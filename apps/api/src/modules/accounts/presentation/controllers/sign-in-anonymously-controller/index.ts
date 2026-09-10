import type { FastifyReply, FastifyRequest } from 'fastify'

import type { SignInAnonymouslyUseCase } from '@/modules/accounts/application/use-cases/sign-in-anonymously/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { SignInAnonymouslyBody } from './schemas.js'

export class SignInAnonymouslyController {
  constructor(private readonly useCase: SignInAnonymouslyUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: SignInAnonymouslyBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const output = await this.useCase.execute({ captchaToken: request.body.captchaToken })

    await reply.code(200).send(ok(output))
  }
}
