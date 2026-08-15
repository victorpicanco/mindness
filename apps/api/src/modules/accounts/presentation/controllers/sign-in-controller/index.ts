import type { FastifyReply, FastifyRequest } from 'fastify'

import type { SignInUseCase } from '@/modules/accounts/application/use-cases/sign-in/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { SignInBody } from './schemas.js'

export class SignInController {
  constructor(private readonly useCase: SignInUseCase) {}

  async handle(request: FastifyRequest<{ Body: SignInBody }>, reply: FastifyReply): Promise<void> {
    const output = await this.useCase.execute({
      email: request.body.email,
      password: request.body.password,
      captchaToken: request.body.captchaToken,
    })

    await reply.code(200).send(ok(output))
  }
}
