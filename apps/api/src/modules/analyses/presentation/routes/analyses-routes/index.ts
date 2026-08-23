import { type TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'

import type { ResolveAccountIdentityUseCase } from '@/modules/analyses/application/use-cases/resolve-account-identity/index.js'
import {
  SessionAnalysisResponseSchema,
  SessionIdParamsSchema,
  type SessionIdParams,
} from '@/modules/analyses/presentation/controllers/get-session-analysis-controller/schemas.js'
import { registerAuthenticatedIdentityGuard } from '@/modules/analyses/presentation/middleware/authenticated-identity-guard/index.js'
import { ErrorResponseSchema } from '@/shared/http/envelope/index.js'

import { ANALYSES_ROUTE_PATHS, type AnalysesControllers } from './types.js'

const ERROR_RESPONSES = {
  400: ErrorResponseSchema,
  401: ErrorResponseSchema,
  404: ErrorResponseSchema,
  500: ErrorResponseSchema,
}

export interface AnalysesRoutesDeps {
  readonly controllers: AnalysesControllers
  readonly resolveAccountIdentity: ResolveAccountIdentityUseCase
}

export async function registerAnalysesRoutes(
  app: FastifyInstance,
  deps: AnalysesRoutesDeps,
): Promise<void> {
  await app.register((scope, _options, done) => {
    registerAuthenticatedIdentityGuard(scope, deps.resolveAccountIdentity)
    const authenticated = scope.withTypeProvider<TypeBoxTypeProvider>()

    authenticated.get<{ Params: SessionIdParams }>(
      ANALYSES_ROUTE_PATHS.sessionAnalysis,
      {
        schema: {
          params: SessionIdParamsSchema,
          response: { 200: SessionAnalysisResponseSchema, ...ERROR_RESPONSES },
        },
      },
      (request, reply) => deps.controllers.getSessionAnalysis.handle(request, reply),
    )

    done()
  })
}
