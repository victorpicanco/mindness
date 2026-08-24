import type { FastifyReply, FastifyRequest } from 'fastify'

import type { ConfirmEmailUseCase } from '@/modules/accounts/application/use-cases/confirm-email/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { ConfirmEmailBody } from './schemas.js'

export class ConfirmEmailController {
  constructor(private readonly useCase: ConfirmEmailUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: ConfirmEmailBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const output = await this.useCase.execute(request.body)
    await reply.code(200).send(ok(output))
  }
}
