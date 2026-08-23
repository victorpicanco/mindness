import type { FastifyReply, FastifyRequest } from 'fastify'

import type { RefreshSessionUseCase } from '@/modules/accounts/application/use-cases/refresh-session/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { RefreshSessionBody } from './schemas.js'

export class RefreshSessionController {
  constructor(private readonly useCase: RefreshSessionUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: RefreshSessionBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const output = await this.useCase.execute({ refreshToken: request.body.refreshToken })

    await reply.code(200).send(ok(output))
  }
}
