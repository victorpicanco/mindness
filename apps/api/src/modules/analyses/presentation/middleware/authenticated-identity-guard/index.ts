import type { FastifyInstance, FastifyRequest } from 'fastify'

import type { ResolveAccountIdentityUseCase } from '@/modules/analyses/application/use-cases/resolve-account-identity/index.js'
import { AnalysisAuthenticationRejectedError } from '@/modules/analyses/domain/errors/analysis-authentication-rejected-error/index.js'

declare module 'fastify' {
  interface FastifyRequest {
    analysesAccountId: string | null
  }
}

const BEARER_PREFIX = 'Bearer '

export function readBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    throw new AnalysisAuthenticationRejectedError()
  }

  const token = header.slice(BEARER_PREFIX.length).trim()
  if (token.length === 0) throw new AnalysisAuthenticationRejectedError()

  return token
}

export function requireResolvedAccountId(request: FastifyRequest): string {
  const accountId = request.analysesAccountId
  if (accountId === null) throw new AnalysisAuthenticationRejectedError()

  return accountId
}

export function registerAuthenticatedIdentityGuard(
  app: FastifyInstance,
  resolveAccountIdentity: ResolveAccountIdentityUseCase,
): void {
  app.decorateRequest('analysesAccountId', null)

  app.addHook('preHandler', async (request) => {
    const { accountId } = await resolveAccountIdentity.execute({
      accessToken: readBearerToken(request),
    })
    request.setDecorator<string | null>('analysesAccountId', accountId)
  })
}
