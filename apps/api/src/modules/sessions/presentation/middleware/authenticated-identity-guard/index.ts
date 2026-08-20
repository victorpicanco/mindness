import type { FastifyInstance, FastifyRequest } from 'fastify'

import { SessionAuthenticationRejectedError } from '@/modules/sessions/domain/errors/session-authentication-rejected-error/index.js'
import type { ResolveAccountIdentityUseCase } from '@/modules/sessions/application/use-cases/resolve-account-identity/index.js'

declare module 'fastify' {
  interface FastifyRequest {
    sessionsAccountId: string | null
  }
}

const BEARER_PREFIX = 'Bearer '

export function readBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    throw new SessionAuthenticationRejectedError()
  }

  const token = header.slice(BEARER_PREFIX.length).trim()
  if (token.length === 0) throw new SessionAuthenticationRejectedError()

  return token
}

export function requireResolvedAccountId(request: FastifyRequest): string {
  const accountId = request.sessionsAccountId
  if (accountId === null) throw new SessionAuthenticationRejectedError()

  return accountId
}

export function registerAuthenticatedIdentityGuard(
  app: FastifyInstance,
  resolveAccountIdentity: ResolveAccountIdentityUseCase,
): void {
  app.decorateRequest('sessionsAccountId', null)

  app.addHook('preHandler', async (request) => {
    const { accountId } = await resolveAccountIdentity.execute({
      accessToken: readBearerToken(request),
    })
    request.setDecorator<string | null>('sessionsAccountId', accountId)
  })
}
