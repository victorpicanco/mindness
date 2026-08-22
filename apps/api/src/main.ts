import 'dotenv/config'

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DeepgramClient } from '@deepgram/sdk'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'
import { Queue } from 'bullmq'
import type { FastifyInstance } from 'fastify'
import { Redis } from 'ioredis'

import { loadConfig } from '@/config.js'
import { registerAccountsModule } from '@/modules/accounts/index.js'
import {
  createAnalysesPrismaClient,
  registerAnalysesModule,
  type AnalysesModuleDeps,
} from '@/modules/analyses/index.js'
import { registerQuotaModule } from '@/modules/quota/index.js'
import {
  createSessionsFacade,
  registerSessionsModule,
  type SessionsModuleDeps,
} from '@/modules/sessions/index.js'
import { registerThemesModule } from '@/modules/themes/index.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { registerHealthRoute } from '@/shared/http/health-route/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import { InProcessEventBus } from '@/shared/messaging/in-process-event-bus/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { SystemClock } from '@/shared/time/system-clock/index.js'

// Must match the queue name the worker side (worker.ts, T-039) uses for its BullMQ Worker.
// BullMQ has no runtime cross-check for this, so a mismatch here means jobs are enqueued
// but silently never picked up by the worker.
const SESSION_ANALYSIS_QUEUE_NAME = 'session-analysis'

export interface AnalysisPipelineModulesDeps {
  readonly sessions: SessionsModuleDeps
  readonly analyses: Omit<AnalysesModuleDeps, 'sessionsFacade'>
}

// D-12: this process publishes `recording_submitted` and must also consume the three analysis
// lifecycle events, published by the worker process — so both modules are registered here too.
export async function registerAnalysisPipelineModules(
  app: FastifyInstance,
  deps: AnalysisPipelineModulesDeps,
) {
  const sessionsContainer = await registerSessionsModule(app, deps.sessions)
  const analysesContainer = registerAnalysesModule(app, {
    ...deps.analyses,
    sessionsFacade: createSessionsFacade({
      findProcessingContext: sessionsContainer.useCases.findProcessingContext,
      downloadAudio: sessionsContainer.useCases.downloadAudio,
      listStuckProcessing: sessionsContainer.useCases.listStuckProcessingSessions,
      checkReadability: sessionsContainer.useCases.checkReadability,
    }),
  })
  return { sessionsContainer, analysesContainer }
}

export async function startServer(): Promise<void> {
  const config = loadConfig(process.env)
  const logger = createLogger({ level: config.logLevel, pretty: config.nodeEnv !== 'production' })
  const app = buildApp({ logger })

  registerHealthRoute(app)

  const prisma = createPrismaClient({
    databaseUrl: config.databaseUrl,
    logQueries: config.nodeEnv !== 'production',
  })
  const eventBus = new InProcessEventBus(logger)
  const clock = new SystemClock()
  const idGenerator = new UuidGenerator()

  const accountsContainer = await registerAccountsModule(app, {
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator,
    config: {
      consentVersion: config.accountsConsentVersion,
      publicApiUrl: config.publicApiUrl,
      secureCookies: config.nodeEnv === 'production',
      supabaseUrl: config.supabaseUrl,
      supabaseSecretKey: config.supabaseSecretKey,
      emailConfirmationRedirectUrl: config.emailConfirmationRedirectUrl,
    },
  })

  const quotaContainer = registerQuotaModule(app, {
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator,
    accountsFacade: accountsContainer.facade,
  })

  const themesContainer = registerThemesModule(app, {
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator,
  })

  const redisConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null })
  const bullMqQueue = new Queue(SESSION_ANALYSIS_QUEUE_NAME, { connection: redisConnection })

  await registerAnalysisPipelineModules(app, {
    sessions: {
      prisma,
      clock,
      eventPublisher: eventBus,
      eventSubscriber: eventBus,
      idGenerator,
      accountsFacade: accountsContainer.facade,
      themesFacade: themesContainer.publicApi,
      quotaFacade: quotaContainer.publicApi,
      supabase: createClient(config.supabaseUrl, config.supabaseSecretKey),
    },
    analyses: {
      prisma: createAnalysesPrismaClient(prisma),
      clock,
      costRates: {
        transcriptionCostPerMinuteMicros: config.deepgramCostPerMinuteMicros,
        geminiInputCostPerMtokMicros: config.geminiInputCostPerMtokMicros,
        geminiOutputCostPerMtokMicros: config.geminiOutputCostPerMtokMicros,
      },
      idGenerator,
      eventPublisher: eventBus,
      eventSubscriber: eventBus,
      logger,
      accountsFacade: accountsContainer.facade,
      themesFacade: themesContainer.publicApi,
      deepgramClient: new DeepgramClient({ apiKey: config.deepgramApiKey }),
      geminiClient: new GoogleGenAI({
        vertexai: true,
        project: config.googleCloudProject,
        location: config.googleCloudLocation,
      }),
      geminiModel: config.geminiModel,
      bullMqQueue,
    },
  })

  app.addHook('onClose', async () => {
    await bullMqQueue.close()
    redisConnection.disconnect()
  })

  await app.listen({ port: config.port })
}

function isMainEntrypoint(): boolean {
  const scriptPath = process.argv[1]
  return scriptPath !== undefined && resolve(scriptPath) === fileURLToPath(import.meta.url)
}

if (isMainEntrypoint()) await startServer()
