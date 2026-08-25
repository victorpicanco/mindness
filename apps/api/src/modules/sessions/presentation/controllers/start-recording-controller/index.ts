import type { FastifyReply, FastifyRequest } from 'fastify'

import type { StartRecordingUseCase } from '@/modules/sessions/application/use-cases/start-recording/index.js'
import { requireResolvedAccountId } from '@/modules/sessions/presentation/middleware/authenticated-identity-guard/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { SessionIdParams } from './schemas.js'

export class StartRecordingController {
  constructor(private readonly useCase: StartRecordingUseCase) {}

  async handle(
    request: FastifyRequest<{ Params: SessionIdParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const output = await this.useCase.execute({
      accountId: requireResolvedAccountId(request),
      sessionId: request.params.sessionId,
    })

    await reply.code(200).send(ok(output))
  }
}
