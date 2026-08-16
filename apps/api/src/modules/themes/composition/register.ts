import type { FastifyInstance } from 'fastify'

import { createThemesContainer, type ThemesContainer, type ThemesModuleDeps } from './container.js'

export function registerThemesModule(
  _app: FastifyInstance,
  deps: ThemesModuleDeps,
): ThemesContainer {
  return createThemesContainer(deps)
}
