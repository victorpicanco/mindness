import type { FastifyReply, FastifyRequest } from 'fastify'

import type { DeleteSessionUseCase } from '@/modules/sessions/application/use-cases/delete-session/index.js'
import { requireResolvedAccountId } from '@/modules/sessions/presentation/middleware/authenticated-identity-guard/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { SessionIdParams } from './schemas.js'

export class DeleteSessionController {
  constructor(private readonly useCase: DeleteSessionUseCase) {}

  async handle(
    request: FastifyRequest<{ Params: SessionIdParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await this.useCase.execute({
      accountId: requireResolvedAccountId(request),
      sessionId: request.params.sessionId,
    })

    await reply.code(200).send(ok(null))
  }
}
