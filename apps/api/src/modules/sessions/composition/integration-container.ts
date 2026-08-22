import type { PrismaClient } from '@/generated/prisma/client.js'
import { SupabaseAudioStorageAdapter } from '@/modules/sessions/infrastructure/adapters/supabase-audio-storage-adapter/index.js'
import { registerSessionsModule } from '@/modules/sessions/index.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'

import {
  createFakeAccountsPort,
  createFakeQuotaPort,
  createFakeThemesPort,
  createInMemorySupabaseStorageClient,
  type FakeAccountsPort,
  type FakeQuotaPort,
  type FakeThemesPort,
  type InMemorySupabaseStorageClient,
} from './integration-fixtures.js'

export const SESSIONS_TEST_NOW = new Date('2026-08-19T12:00:00.000Z')

export interface SessionsIntegrationDeps {
  readonly databaseUrl: string
}

export interface SessionsIntegrationContainer {
  readonly app: ReturnType<typeof buildApp>
  readonly prisma: PrismaClient
  readonly eventBus: FakeEventBus
  readonly clock: ControllableClock
  readonly accounts: FakeAccountsPort
  readonly themes: FakeThemesPort
  readonly quota: FakeQuotaPort
  readonly storage: InMemorySupabaseStorageClient
  readonly container: Awaited<ReturnType<typeof registerSessionsModule>>
  reset(): void
  close(): Promise<void>
}

export async function createSessionsIntegrationContainer(
  deps: SessionsIntegrationDeps,
): Promise<SessionsIntegrationContainer> {
  const app = buildApp({ logger: createLogger({ level: 'silent', pretty: false }) })
  const prisma = createPrismaClient({ databaseUrl: deps.databaseUrl, logQueries: false })
  const eventBus = new FakeEventBus()
  const clock = new ControllableClock(SESSIONS_TEST_NOW)
  const accounts = createFakeAccountsPort()
  const themes = createFakeThemesPort()
  const quota = createFakeQuotaPort()
  const storage = createInMemorySupabaseStorageClient()
  const container = await registerSessionsModule(app, {
    prisma,
    clock,
    idGenerator: new UuidGenerator(),
    eventPublisher: eventBus,
    eventSubscriber: eventBus,
    adapters: {
      accounts,
      themes,
      quota,
      audioStorage: new SupabaseAudioStorageAdapter(storage),
    },
  })
  await app.ready()

  return {
    app,
    prisma,
    eventBus,
    clock,
    accounts,
    themes,
    quota,
    storage,
    container,
    reset: () => {
      eventBus.published.length = 0
      clock.set(SESSIONS_TEST_NOW)
      accounts.reset()
      themes.reset()
      quota.reset()
      storage.reset()
    },
    close: async () => {
      await app.close()
      await prisma.$disconnect()
    },
  }
}
