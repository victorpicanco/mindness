import type { FastifyReply, FastifyRequest } from 'fastify'

import type { RequestPasswordRecoveryUseCase } from '@/modules/accounts/application/use-cases/request-password-recovery/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { RequestPasswordRecoveryBody } from './schemas.js'

export class RequestPasswordRecoveryController {
  constructor(private readonly useCase: RequestPasswordRecoveryUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: RequestPasswordRecoveryBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    await reply.code(202).send(ok(await this.useCase.execute(request.body)))
  }
}
