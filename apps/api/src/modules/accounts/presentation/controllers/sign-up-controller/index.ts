import type { FastifyReply, FastifyRequest } from 'fastify'

import type { SignUpUseCase } from '@/modules/accounts/application/use-cases/sign-up/index.js'
import { ok } from '@/shared/http/envelope/index.js'

import type { SignUpBody } from './schemas.js'

export class SignUpController {
  constructor(private readonly useCase: SignUpUseCase) {}

  async handle(request: FastifyRequest<{ Body: SignUpBody }>, reply: FastifyReply): Promise<void> {
    const output = await this.useCase.execute({
      email: request.body.email,
      password: request.body.password,
      captchaToken: request.body.captchaToken,
    })

    await reply.code(202).send(ok({ message: output.message }))
  }
}
