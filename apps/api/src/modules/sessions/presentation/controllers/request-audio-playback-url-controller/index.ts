import type { FastifyReply, FastifyRequest } from 'fastify'

import type { RequestAudioPlaybackUrlUseCase } from '@/modules/sessions/application/use-cases/request-audio-playback-url/index.js'
import { requireResolvedAccountId } from '@/modules/sessions/presentation/middleware/authenticated-identity-guard/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { SessionIdParams } from './schemas.js'

export class RequestAudioPlaybackUrlController {
  constructor(private readonly useCase: RequestAudioPlaybackUrlUseCase) {}

  async handle(
    request: FastifyRequest<{ Params: SessionIdParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const output = await this.useCase.execute({
      accountId: requireResolvedAccountId(request),
      sessionId: request.params.sessionId,
    })

    reply.header('cache-control', 'no-store')
    reply.header('x-content-type-options', 'nosniff')
    await reply.code(200).send(ok(output))
  }
}
