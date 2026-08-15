import type { FastifyReply, FastifyRequest } from 'fastify'

import type { CreateAccountUseCase } from '@/modules/accounts/application/use-cases/create-account/index.js'
import { readBearerToken } from '@/modules/accounts/presentation/middleware/authenticated-identity/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { CreateAccountBody } from './schemas.js'

export class CreateAccountController {
  constructor(private readonly useCase: CreateAccountUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: CreateAccountBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const output = await this.useCase.execute({
      accessToken: readBearerToken(request),
      timeZone: request.body.timeZone,
    })

    await reply.code(200).send(ok({ message: output.message }))
  }
}
