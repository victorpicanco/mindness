import type { PrismaClient } from '@/generated/prisma/client.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'

import { createQuotaContainer, type QuotaContainer } from './container.js'
import { createFakeAccountsPort, type FakeAccountsPort } from './integration-fixtures.js'

export const QUOTA_TEST_NOW = new Date('2026-08-16T12:00:00.000Z')

export interface QuotaIntegrationDeps {
  readonly databaseUrl: string
}

export interface QuotaIntegrationContainer {
  readonly prisma: PrismaClient
  readonly container: QuotaContainer
  readonly repositories: QuotaContainer['repositories']
  readonly eventBus: FakeEventBus
  readonly clock: ControllableClock
  readonly accounts: FakeAccountsPort
  reset(): void
  close(): Promise<void>
}

export function createQuotaIntegrationContainer(
  deps: QuotaIntegrationDeps,
): QuotaIntegrationContainer {
  const prisma = createPrismaClient({ databaseUrl: deps.databaseUrl, logQueries: false })
  const eventBus = new FakeEventBus()
  const clock = new ControllableClock(QUOTA_TEST_NOW)
  const accounts = createFakeAccountsPort()
  const container = createQuotaContainer({
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator: new UuidGenerator(),
    accountsFacade: {
      getAccountSnapshot: () => Promise.resolve(null),
    },
    adapters: { accounts },
  })

  return {
    prisma,
    container,
    repositories: container.repositories,
    eventBus,
    clock,
    accounts,
    reset: () => {
      eventBus.published.length = 0
      clock.set(QUOTA_TEST_NOW)
      accounts.reset()
    },
    close: async () => {
      await prisma.$disconnect()
    },
  }
}
