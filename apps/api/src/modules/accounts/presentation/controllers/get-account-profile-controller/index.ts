import type { FastifyReply, FastifyRequest } from 'fastify'

import type { GetAccountProfileUseCase } from '@/modules/accounts/application/use-cases/get-account-profile/index.js'
import { readBearerToken } from '@/modules/accounts/presentation/middleware/authenticated-identity/index.js'
import { ok } from '@/shared/http/envelope/index.js'

export class GetAccountProfileController {
  constructor(private readonly useCase: GetAccountProfileUseCase) {}

  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const output = await this.useCase.execute({ accessToken: readBearerToken(request) })

    await reply.code(200).send(ok(output))
  }
}
