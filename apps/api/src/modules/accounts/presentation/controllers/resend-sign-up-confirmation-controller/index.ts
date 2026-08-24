import type { FastifyReply, FastifyRequest } from 'fastify'

import type { ResendSignUpConfirmationUseCase } from '@/modules/accounts/application/use-cases/resend-sign-up-confirmation/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { ResendSignUpConfirmationBody } from './schemas.js'

export class ResendSignUpConfirmationController {
  constructor(private readonly useCase: ResendSignUpConfirmationUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: ResendSignUpConfirmationBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    await reply.code(202).send(ok(await this.useCase.execute(request.body)))
  }
}
