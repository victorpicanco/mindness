import type { FastifyInstance } from 'fastify'

import { InMemoryAuthIdentityProviderAdapter } from '@/modules/accounts/infrastructure/adapters/in-memory-auth-identity-provider-adapter/index.js'
import { InMemorySubscriptionCancellationAdapter } from '@/modules/accounts/infrastructure/adapters/in-memory-subscription-cancellation-adapter/index.js'
import type { PrismaClient } from '@/generated/prisma/client.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'

import type { AccountsContainer } from './container.js'
import { registerAccountsModule } from './register.js'

const TEST_CONSENT_VERSION = '2026-08-15'
const TEST_NOW = new Date('2026-08-15T12:00:00.000Z')

export interface AccountsIntegrationDeps {
  readonly databaseUrl: string
}

export interface AccountsTestApp {
  readonly app: FastifyInstance
  readonly prisma: PrismaClient
  readonly container: AccountsContainer
  readonly repositories: AccountsContainer['repositories']
  readonly eventBus: FakeEventBus
  readonly clock: ControllableClock
  readonly authIdentityProvider: InMemoryAuthIdentityProviderAdapter
  readonly subscriptionCancellation: InMemorySubscriptionCancellationAdapter
  reset(): void
  close(): Promise<void>
}

export async function buildAccountsTestApp(
  deps: AccountsIntegrationDeps,
): Promise<AccountsTestApp> {
  const prisma = createPrismaClient({ databaseUrl: deps.databaseUrl, logQueries: false })
  const eventBus = new FakeEventBus()
  const clock = new ControllableClock(TEST_NOW)
  const idGenerator = new UuidGenerator()
  const authIdentityProvider = new InMemoryAuthIdentityProviderAdapter(clock, idGenerator)
  const subscriptionCancellation = new InMemorySubscriptionCancellationAdapter()
  const app = buildApp({ logger: createLogger({ level: 'silent', pretty: false }) })

  const container = await registerAccountsModule(app, {
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator,
    config: {
      consentVersion: TEST_CONSENT_VERSION,
      publicApiUrl: 'https://api.test',
      publicWebUrl: 'https://app.test',
      secureCookies: false,
      supabaseUrl: 'https://project.supabase.test',
      supabasePublishableKey: 'test-publishable-key',
      supabaseSecretKey: 'test-secret-key',
      emailConfirmationRedirectUrl: 'https://app.test/auth/confirmed',
      // High enough that no integration flow trips it; the limit itself is
      // covered by the auth-rate-limit unit test.
      authRateLimit: { max: 10_000, timeWindowMs: 60_000 },
    },
    adapters: { authIdentityProvider, subscriptionCancellation },
  })

  await app.ready()

  return {
    app,
    prisma,
    container,
    repositories: container.repositories,
    eventBus,
    clock,
    authIdentityProvider,
    subscriptionCancellation,
    reset: () => {
      eventBus.published.length = 0
      authIdentityProvider.reset()
      subscriptionCancellation.reset()
      clock.set(TEST_NOW)
    },
    close: async () => {
      await app.close()
      await prisma.$disconnect()
    },
  }
}
