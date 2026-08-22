import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  interface ProvidedContext {
    redisUrl: string
  }
}

let container: StartedRedisContainer | undefined

export async function setup(project: TestProject): Promise<void> {
  container = await new RedisContainer('redis:8').start()

  project.provide('redisUrl', container.getConnectionUrl())
}

export async function teardown(): Promise<void> {
  await container?.stop()
}
