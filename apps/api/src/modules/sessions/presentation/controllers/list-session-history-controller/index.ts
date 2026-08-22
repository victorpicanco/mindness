import type { FastifyReply, FastifyRequest } from 'fastify'

import type { ListSessionHistoryUseCase } from '@/modules/sessions/application/use-cases/list-session-history/index.js'
import { requireResolvedAccountId } from '@/modules/sessions/presentation/middleware/authenticated-identity-guard/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { SessionHistoryQuery } from './schemas.js'

export class ListSessionHistoryController {
  constructor(private readonly useCase: ListSessionHistoryUseCase) {}

  async handle(
    request: FastifyRequest<{ Querystring: SessionHistoryQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const output = await this.useCase.execute({
      accountId: requireResolvedAccountId(request),
      cursor: request.query.cursor ?? null,
    })

    await reply.code(200).send(
      ok(output.items, {
        nextCursor: output.nextCursor,
        pageSize: output.pageSize,
        timeZone: output.timeZone,
      }),
    )
  }
}
