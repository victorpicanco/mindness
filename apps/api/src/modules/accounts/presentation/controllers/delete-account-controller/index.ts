import type { FastifyReply, FastifyRequest } from 'fastify'

import type { DeleteAccountUseCase } from '@/modules/accounts/application/use-cases/delete-account/index.js'
import {
  readBearerToken,
  requireAuthenticatedIdentity,
} from '@/modules/accounts/presentation/middleware/authenticated-identity/index.js'
import { ok } from '@/shared/http/envelope/index.js'

export class DeleteAccountController {
  constructor(private readonly useCase: DeleteAccountUseCase) {}

  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const output = await this.useCase.execute({
      accessToken: readBearerToken(request),
      identity: requireAuthenticatedIdentity(request),
    })

    await reply.code(200).send(ok(output))
  }
}
