import type { FastifyReply, FastifyRequest } from 'fastify'

import type { StartSessionUseCase } from '@/modules/sessions/application/use-cases/start-session/index.js'
import { requireResolvedAccountId } from '@/modules/sessions/presentation/middleware/authenticated-identity-guard/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { StartSessionBody } from './schemas.js'

export class StartSessionController {
  constructor(private readonly useCase: StartSessionUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: StartSessionBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const output = await this.useCase.execute({
      accountId: requireResolvedAccountId(request),
      difficulty: request.body.difficulty,
      categorySlug: request.body.categorySlug,
      searchWindowMinutes: request.body.searchWindowMinutes,
    })

    await reply.code(201).send(ok(output))
  }
}
