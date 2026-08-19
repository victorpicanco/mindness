import type { FastifyReply, FastifyRequest } from 'fastify'

import type { ExpireSessionUseCase } from '@/modules/sessions/application/use-cases/expire-session/index.js'
import { requireResolvedAccountId } from '@/modules/sessions/presentation/middleware/authenticated-identity-guard/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { SessionIdParams } from './schemas.js'

export class AbandonSessionController {
  constructor(private readonly useCase: ExpireSessionUseCase) {}

  async handle(
    request: FastifyRequest<{ Params: SessionIdParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await this.useCase.execute({
      accountId: requireResolvedAccountId(request),
      sessionId: request.params.sessionId,
      reason: 'abandoned',
    })

    await reply.code(200).send(ok(null))
  }
}
