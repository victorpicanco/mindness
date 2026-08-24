import type { FastifyReply, FastifyRequest } from 'fastify'

import type { UpdatePasswordUseCase } from '@/modules/accounts/application/use-cases/update-password/index.js'
import { requireAuthenticatedIdentity } from '@/modules/accounts/presentation/middleware/authenticated-identity/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { UpdatePasswordBody } from './schemas.js'

export class UpdatePasswordController {
  constructor(private readonly useCase: UpdatePasswordUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: UpdatePasswordBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const identity = requireAuthenticatedIdentity(request)
    const output = await this.useCase.execute({
      authUserId: identity.authUserId,
      password: request.body.password,
    })
    await reply.code(200).send(ok(output))
  }
}
