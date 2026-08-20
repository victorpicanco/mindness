import type { FastifyReply, FastifyRequest } from 'fastify'

import type { GetActiveSessionUseCase } from '@/modules/sessions/application/use-cases/get-active-session/index.js'
import { requireResolvedAccountId } from '@/modules/sessions/presentation/middleware/authenticated-identity-guard/index.js'
import { ok } from '@/shared/http/envelope/index.js'

export class GetActiveSessionController {
  constructor(private readonly useCase: GetActiveSessionUseCase) {}

  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const output = await this.useCase.execute({ accountId: requireResolvedAccountId(request) })

    await reply.code(200).send(ok(output))
  }
}
