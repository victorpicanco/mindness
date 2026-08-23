import type { FastifyReply, FastifyRequest } from 'fastify'

import type { GetSessionAnalysisUseCase } from '@/modules/analyses/application/use-cases/get-session-analysis/index.js'
import { requireResolvedAccountId } from '@/modules/analyses/presentation/middleware/authenticated-identity-guard/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { SessionIdParams } from './schemas.js'

export class GetSessionAnalysisController {
  constructor(private readonly useCase: GetSessionAnalysisUseCase) {}

  async handle(
    request: FastifyRequest<{ Params: SessionIdParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const output = await this.useCase.execute({
      accountId: requireResolvedAccountId(request),
      sessionId: request.params.sessionId,
    })

    reply.header('x-content-type-options', 'nosniff')
    await reply.code(200).send(ok(output))
  }
}
