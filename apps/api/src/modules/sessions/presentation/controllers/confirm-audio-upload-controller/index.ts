import type { FastifyReply, FastifyRequest } from 'fastify'

import type { ConfirmAudioUploadUseCase } from '@/modules/sessions/application/use-cases/confirm-audio-upload/index.js'
import { requireResolvedAccountId } from '@/modules/sessions/presentation/middleware/authenticated-identity-guard/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { SessionIdParams } from './schemas.js'

export class ConfirmAudioUploadController {
  constructor(private readonly useCase: ConfirmAudioUploadUseCase) {}

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
