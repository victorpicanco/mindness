import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  interface ProvidedContext {
    databaseUrl: string
  }
}

const run = promisify(execFile)

let container: StartedPostgreSqlContainer | undefined

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer('postgres:17-alpine').start()
  const databaseUrl = container.getConnectionUri()
  for (const file of ['./supabase-roles.sql', './storage-schema.sql']) {
    await run(
      'pnpm',
      ['exec', 'prisma', 'db', 'execute', '--file', fileURLToPath(new URL(file, import.meta.url))],
      { env: { ...process.env, DATABASE_URL: databaseUrl } },
    )
  }

  await run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  })

  project.provide('databaseUrl', databaseUrl)
}

export async function teardown(): Promise<void> {
  await container?.stop()
}
