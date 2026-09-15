import { registerAccountsModule } from '@/modules/accounts/index.js'
import { InMemoryAuthIdentityProviderAdapter } from '@/modules/accounts/infrastructure/adapters/in-memory-auth-identity-provider-adapter/index.js'
import { InMemorySubscriptionCancellationAdapter } from '@/modules/accounts/infrastructure/adapters/in-memory-subscription-cancellation-adapter/index.js'
import { createAnalysesPrismaClient, registerAnalysesModule } from '@/modules/analyses/index.js'
import {
  createFakeAccountsPort as createAnalysisAccounts,
  createFakeSessionsPort as createAnalysisSessions,
  InMemoryAudioPreparationAdapter,
  InMemoryAudioReaderAdapter,
  InMemoryEvaluationAdapter,
  InMemoryProcessingQueueAdapter,
  InMemoryTranscriptionAdapter,
} from '@/modules/analyses/composition/integration-fixtures.js'
import { registerSessionsModule } from '@/modules/sessions/index.js'
import {
  createFakeAccountsPort as createSessionAccounts,
  createFakeThemesPort,
  createInMemorySupabaseStorageClient,
} from '@/modules/sessions/composition/integration-fixtures.js'
import { SupabaseAudioStorageAdapter } from '@/modules/sessions/infrastructure/adapters/supabase-audio-storage-adapter/index.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { registerHealthRoute } from '@/shared/http/health-route/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { SystemClock } from '@/shared/time/system-clock/index.js'

const API_PORT = 3101
const DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:65432/mindness'

async function startE2eServer(): Promise<void> {
  const logger = createLogger({ level: 'silent', pretty: false })
  const app = buildApp({ logger })
  const prisma = createPrismaClient({ databaseUrl: DATABASE_URL, logQueries: false })
  const clock = new SystemClock()
  const idGenerator = new UuidGenerator()
  const eventBus = new FakeEventBus()

  registerHealthRoute(app)
  await registerAccountsModule(app, {
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator,
    config: {
      consentVersion: '2026-08-15',
      publicApiUrl: `http://127.0.0.1:${String(API_PORT)}`,
      publicWebUrl: 'http://127.0.0.1:3100',
      secureCookies: false,
      supabaseUrl: 'https://project.supabase.test',
      supabasePublishableKey: 'test-publishable-key',
      supabaseSecretKey: 'test-secret-key',
      emailConfirmationRedirectUrl: 'http://127.0.0.1:3100/auth/confirmed',
      authRateLimit: { max: 10_000, timeWindowMs: 60_000 },
    },
    adapters: {
      authIdentityProvider: new InMemoryAuthIdentityProviderAdapter(clock, idGenerator),
      subscriptionCancellation: new InMemorySubscriptionCancellationAdapter(),
    },
  })

  const sessionThemes = createFakeThemesPort()
  sessionThemes.registerEligibleTheme({
    categoryId: '33eb7588-004a-4bd5-a41a-1650201e58d2',
    categoryName: 'Tecnologia',
    categorySlug: 'tecnologia',
    difficulty: 'balanced',
    themeId: 'a72ef196-0002-440f-b107-3bb182dca65e',
  })
  await registerSessionsModule(app, {
    prisma,
    clock,
    eventPublisher: eventBus,
    eventSubscriber: eventBus,
    idGenerator,
    adapters: {
      accounts: createSessionAccounts(),
      audioStorage: new SupabaseAudioStorageAdapter(createInMemorySupabaseStorageClient(clock)),
      themes: sessionThemes,
    },
  })

  await registerAnalysesModule(app, {
    prisma: createAnalysesPrismaClient(prisma),
    clock,
    costRates: {
      transcriptionCostPerMinuteMicros: 1,
      geminiInputCostPerMtokMicros: 1,
      geminiOutputCostPerMtokMicros: 1,
    },
    idGenerator,
    eventPublisher: eventBus,
    eventSubscriber: eventBus,
    logger: { warn: () => undefined },
    adapters: {
      accounts: createAnalysisAccounts(),
      sessions: createAnalysisSessions(),
      themes: { findTitle: () => Promise.resolve('Theme') },
      audioPreparation: new InMemoryAudioPreparationAdapter(),
      audioReader: new InMemoryAudioReaderAdapter(),
      transcription: new InMemoryTranscriptionAdapter({
        text: 'Transcript',
        words: [{ word: 'Transcript', start: 0, end: 1, confidence: 1 }],
        averageConfidence: 1,
        durationSeconds: 1,
      }),
      evaluation: new InMemoryEvaluationAdapter({
        feedback: { summary: 'Summary', strengths: [], improvements: [] },
        inputTokens: 1,
        outputTokens: 1,
      }),
      processingQueue: new InMemoryProcessingQueueAdapter(),
    },
  })

  const close = async (): Promise<void> => {
    await app.close()
    await prisma.$disconnect()
  }
  process.once('SIGINT', () => void close())
  process.once('SIGTERM', () => void close())

  await app.listen({ host: '127.0.0.1', port: API_PORT })
}

await startE2eServer()
