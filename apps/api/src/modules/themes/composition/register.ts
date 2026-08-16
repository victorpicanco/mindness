import type { FastifyInstance } from 'fastify'

import { registerThemesErrorHandler } from '@/modules/themes/presentation/error-handler/index.js'

import { createThemesContainer, type ThemesContainer, type ThemesModuleDeps } from './container.js'

export function registerThemesModule(
  app: FastifyInstance,
  deps: ThemesModuleDeps,
): ThemesContainer {
  const container = createThemesContainer(deps)
  registerThemesErrorHandler(app)

  return container
}
