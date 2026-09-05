import type { FastifyReply, FastifyRequest } from 'fastify'

import type { UpdateAccountNameUseCase } from '@/modules/accounts/application/use-cases/update-account-name/index.js'
import { requireAuthenticatedIdentity } from '@/modules/accounts/presentation/middleware/authenticated-identity/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { UpdateAccountNameBody } from './schemas.js'

export class UpdateAccountNameController {
  constructor(private readonly useCase: UpdateAccountNameUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: UpdateAccountNameBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const output = await this.useCase.execute({
      identity: requireAuthenticatedIdentity(request),
      name: request.body.name,
    })

    await reply.code(200).send(ok(output))
  }
}
