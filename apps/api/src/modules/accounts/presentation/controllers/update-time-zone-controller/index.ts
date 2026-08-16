import type { FastifyReply, FastifyRequest } from 'fastify'

import type { UpdateTimeZoneUseCase } from '@/modules/accounts/application/use-cases/update-time-zone/index.js'
import { requireAuthenticatedIdentity } from '@/modules/accounts/presentation/middleware/authenticated-identity/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { UpdateTimeZoneBody } from './schemas.js'

export class UpdateTimeZoneController {
  constructor(private readonly useCase: UpdateTimeZoneUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: UpdateTimeZoneBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const output = await this.useCase.execute({
      identity: requireAuthenticatedIdentity(request),
      timeZone: request.body.timeZone,
    })

    await reply.code(200).send(ok(output))
  }
}
