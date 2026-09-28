import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const dockerfileSource = readFile(resolve(process.cwd(), 'Dockerfile'), 'utf8')
const deployWorkflowSource = readFile(
  resolve(process.cwd(), '../../.github/workflows/deploy.yml'),
  'utf8',
)
const localComposeSource = readFile(resolve(process.cwd(), '../../compose.local.yaml'), 'utf8')

describe('web image configuration', () => {
  it('provides the server API URL while building the application', async () => {
    await expect(dockerfileSource).resolves.toContain('ARG API_BASE_URL')
    await expect(dockerfileSource).resolves.toContain('API_BASE_URL=$API_BASE_URL')
    await expect(deployWorkflowSource).resolves.toContain(
      'API_BASE_URL=${{ vars.NEXT_PUBLIC_API_BASE_URL }}',
    )
    await expect(localComposeSource).resolves.toContain(
      'API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL:-http://localhost:3333}',
    )
  })
})
