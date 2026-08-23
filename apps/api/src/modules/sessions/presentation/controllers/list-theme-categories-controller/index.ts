import type { FastifyReply, FastifyRequest } from 'fastify'

import type { ListSessionThemeCategoriesUseCase } from '@/modules/sessions/application/use-cases/list-theme-categories/index.js'
import { ok } from '@/shared/http/envelope/index.js'

export class ListThemeCategoriesController {
  constructor(private readonly useCase: ListSessionThemeCategoriesUseCase) {}

  async handle(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await reply.code(200).send(ok(await this.useCase.execute()))
  }
}
