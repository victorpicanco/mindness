import type { FastifyReply, FastifyRequest } from 'fastify'

import type { AcceptConsentUseCase } from '@/modules/accounts/application/use-cases/accept-consent/index.js'
import { readBearerToken } from '@/modules/accounts/presentation/middleware/authenticated-identity/index.js'
import { ok } from '@/shared/http/envelope/index.js'

export class AcceptConsentController {
  constructor(private readonly useCase: AcceptConsentUseCase) {}

  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const output = await this.useCase.execute({ accessToken: readBearerToken(request) })

    await reply.code(200).send(ok(output))
  }
}
