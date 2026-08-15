import { existsSync, readdirSync } from 'node:fs'

const MODULES_DIR = 'apps/api/src/modules'

function discoverModuleScopes() {
  if (!existsSync(MODULES_DIR)) return []
  return readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [...discoverModuleScopes(), 'shared', 'web', 'infra', 'deps', 'release'],
    ],
    'subject-case': [0],
  },
}
