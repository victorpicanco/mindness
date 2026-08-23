import type { FastifyReply, FastifyRequest } from 'fastify'

import type { GetSessionQuotaBalanceUseCase } from '@/modules/sessions/application/use-cases/get-quota-balance/index.js'
import { requireResolvedAccountId } from '@/modules/sessions/presentation/middleware/authenticated-identity-guard/index.js'
import { ok } from '@/shared/http/envelope/index.js'

export class GetQuotaBalanceController {
  constructor(private readonly useCase: GetSessionQuotaBalanceUseCase) {}

  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const balance = await this.useCase.execute({ accountId: requireResolvedAccountId(request) })
    const output = balance.enforced
      ? {
          ...balance,
          renewsAt: balance.renewsAt.toISOString(),
        }
      : balance

    await reply.code(200).send(ok(output))
  }
}
