import type { FastifyInstance, FastifyRequest } from 'fastify'

import type { AuthenticateUseCase } from '@/modules/accounts/application/use-cases/authenticate/index.js'
import type { AuthenticateOutput } from '@/modules/accounts/application/use-cases/authenticate/types.js'
import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'

declare module 'fastify' {
  interface FastifyRequest {
    accountIdentity: AuthenticateOutput | null
  }
}

const BEARER_PREFIX = 'Bearer '

export function readBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    throw new AuthenticationRejectedError('invalid_token')
  }

  const token = header.slice(BEARER_PREFIX.length).trim()
  if (token.length === 0) throw new AuthenticationRejectedError('invalid_token')

  return token
}

export function requireAuthenticatedIdentity(request: FastifyRequest): AuthenticateOutput {
  const identity = request.accountIdentity
  if (identity === null) throw new AuthenticationRejectedError('invalid_token')

  return identity
}

export function registerAuthenticatedIdentity(
  app: FastifyInstance,
  authenticate: AuthenticateUseCase,
): void {
  app.decorateRequest('accountIdentity', null)

  app.addHook('preHandler', async (request) => {
    const identity = await authenticate.execute({ accessToken: readBearerToken(request) })
    request.setDecorator<AuthenticateOutput | null>('accountIdentity', identity)
  })
}
