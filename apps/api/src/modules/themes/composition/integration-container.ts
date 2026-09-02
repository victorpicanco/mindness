import type { PrismaClient } from '@/generated/prisma/client.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'

import { createThemesContainer, type ThemesContainer } from './container.js'

const THEMES_TEST_NOW = new Date('2026-08-16T12:00:00.000Z')

export interface ThemesIntegrationDeps {
  readonly databaseUrl: string
}

export interface ThemesIntegrationContainer {
  readonly prisma: PrismaClient
  readonly container: ThemesContainer
  readonly repositories: ThemesContainer['repositories']
  readonly eventBus: FakeEventBus
  readonly clock: ControllableClock
  reset(): void
  close(): Promise<void>
}

export function createThemesIntegrationContainer(
  deps: ThemesIntegrationDeps,
): ThemesIntegrationContainer {
  const prisma = createPrismaClient({ databaseUrl: deps.databaseUrl, logQueries: false })
  const eventBus = new FakeEventBus()
  const clock = new ControllableClock(THEMES_TEST_NOW)
  const container = createThemesContainer({
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator: new UuidGenerator(),
  })

  return {
    prisma,
    container,
    repositories: container.repositories,
    eventBus,
    clock,
    reset: () => {
      eventBus.published.length = 0
      clock.set(THEMES_TEST_NOW)
    },
    close: async () => {
      await prisma.$disconnect()
    },
  }
}
