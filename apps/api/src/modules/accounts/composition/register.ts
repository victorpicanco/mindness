import type { FastifyInstance } from 'fastify'

import { registerAccountsRoutes } from '@/modules/accounts/presentation/routes/accounts-routes/index.js'

import {
  createAccountsContainer,
  type AccountsContainer,
  type AccountsModuleDeps,
} from './container.js'

export async function registerAccountsModule(
  app: FastifyInstance,
  deps: AccountsModuleDeps,
): Promise<AccountsContainer> {
  const container = createAccountsContainer(deps)

  await app.register(async (scope) => {
    await registerAccountsRoutes(scope, {
      controllers: container.controllers,
      authenticate: container.useCases.authenticate,
    })
  })

  return container
}
