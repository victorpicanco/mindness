import type { FastifyReply, FastifyRequest } from 'fastify'

import type { SignOutUseCase } from '@/modules/accounts/application/use-cases/sign-out/index.js'
import { readBearerToken } from '@/modules/accounts/presentation/middleware/authenticated-identity/index.js'
import { ok } from '@/shared/http/envelope/index.js'

export class SignOutController {
  constructor(private readonly useCase: SignOutUseCase) {}

  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await reply
      .code(200)
      .send(ok(await this.useCase.execute({ accessToken: readBearerToken(request) })))
  }
}
