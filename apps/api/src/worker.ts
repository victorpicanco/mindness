import 'dotenv/config'

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DeepgramClient } from '@deepgram/sdk'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'
import { Queue, UnrecoverableError, Worker } from 'bullmq'
import type { FastifyInstance } from 'fastify'
import { Redis } from 'ioredis'

import type { AnalysisPipelineUseCase } from '@/modules/analyses/index.js'
import type { ReconcileOrphanAnalysesUseCase } from '@/modules/analyses/application/use-cases/reconcile-orphan-analyses/index.js'
import type { SweepExpiredSessionsUseCase } from '@/modules/sessions/application/use-cases/sweep-expired-sessions/index.js'
import { loadConfig } from '@/config.js'
import { createAccountsContainer } from '@/modules/accounts/composition/container.js'
import {
  createAnalysesPrismaClient,
  registerAnalysesModule,
  type AnalysesModuleDeps,
} from '@/modules/analyses/index.js'
import {
  createSessionsFacade,
  registerSessionsModule,
  type SessionsModuleDeps,
} from '@/modules/sessions/index.js'
import { createThemesContainer } from '@/modules/themes/composition/container.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { BaseError } from '@/shared/errors/base-error/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { registerHealthRoute } from '@/shared/http/health-route/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import { InProcessEventBus } from '@/shared/messaging/in-process-event-bus/index.js'
import { SystemClock } from '@/shared/time/system-clock/index.js'

export const SWEEP_INTERVAL_MS = 60_000

export const ORPHAN_ANALYSIS_STALE_AFTER_MS = 60_000
export const ORPHAN_ANALYSIS_RECONCILIATION_INTERVAL_MS = 60_000
export const ORPHAN_ANALYSIS_RECONCILIATION_LIMIT = 100

const SESSION_ANALYSIS_QUEUE_NAME = 'session-analysis'

const ANALYSIS_DEADLINE_EXCEEDED_CODE = 'analyses.ANALYSIS_DEADLINE_EXCEEDED'

export interface AnalysisPipelineModulesDeps {
  readonly sessions: SessionsModuleDeps
  readonly analyses: Omit<AnalysesModuleDeps, 'sessionsFacade'>
}

export async function registerAnalysisPipelineModules(
  app: FastifyInstance,
  deps: AnalysisPipelineModulesDeps,
) {
  const sessionsContainer = await registerSessionsModule(app, deps.sessions)
  const analysesContainer = await registerAnalysesModule(app, {
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

type AnalysisProcessor = (job: { readonly data: { readonly sessionId: string } }) => Promise<void>

export interface AnalysisWorkerHandle {
  close(): Promise<void>
}

export interface CreateAnalysisWorkerDeps {
  readonly processSessionAudio: AnalysisPipelineUseCase
  readonly concurrency: number
  readonly createWorker: (
    processor: AnalysisProcessor,
    options: { readonly concurrency: number },
  ) => AnalysisWorkerHandle
}

export function createAnalysisWorker(deps: CreateAnalysisWorkerDeps): AnalysisWorkerHandle {
  const processor: AnalysisProcessor = async (job) => {
    try {
      await deps.processSessionAudio.execute({ sessionId: job.data.sessionId })
    } catch (error) {
      if (error instanceof BaseError && error.code === ANALYSIS_DEADLINE_EXCEEDED_CODE) {
        throw new UnrecoverableError(error.message)
      }
      throw error
    }
  }

  return deps.createWorker(processor, { concurrency: deps.concurrency })
}

export async function closeAnalysisWorker(
  worker: Pick<AnalysisWorkerHandle, 'close'>,
  connection: { disconnect(): void },
): Promise<void> {
  await worker.close()
  connection.disconnect()
}

type SweepExpiredSessions = Pick<SweepExpiredSessionsUseCase, 'execute'>

export interface WorkerSweepLogger {
  error(object: { readonly err: unknown }, message: string): void
}

export interface WorkerSweepDeps {
  readonly sweepExpiredSessions: SweepExpiredSessions
  readonly logger: WorkerSweepLogger
  readonly schedule?: (callback: () => void, interval: number) => StopSweep
}

export type StopSweep = () => void

async function sweepExpiredSessions(deps: WorkerSweepDeps): Promise<void> {
  try {
    await deps.sweepExpiredSessions.execute()
  } catch (error) {
    deps.logger.error({ err: error }, 'Failed to sweep expired sessions')
  }
}

export function registerExpiredSessionSweep(deps: WorkerSweepDeps): StopSweep {
  const schedule =
    deps.schedule ??
    ((callback, interval) => {
      const timer = setInterval(callback, interval)
      timer.unref()

      return () => {
        clearInterval(timer)
      }
    })

  return schedule(() => {
    void sweepExpiredSessions(deps)
  }, SWEEP_INTERVAL_MS)
}

type ReconcileOrphanAnalyses = Pick<ReconcileOrphanAnalysesUseCase, 'execute'>

export interface WorkerReconciliationSweepDeps {
  readonly reconcileOrphanAnalyses: ReconcileOrphanAnalyses
  readonly logger: WorkerSweepLogger
  readonly schedule?: (callback: () => void, interval: number) => StopSweep
}

async function reconcileOrphanAnalyses(deps: WorkerReconciliationSweepDeps): Promise<void> {
  try {
    await deps.reconcileOrphanAnalyses.execute({
      staleAfterMs: ORPHAN_ANALYSIS_STALE_AFTER_MS,
      limit: ORPHAN_ANALYSIS_RECONCILIATION_LIMIT,
    })
  } catch (error) {
    deps.logger.error({ err: error }, 'Failed to reconcile orphan analyses')
  }
}

export function registerOrphanAnalysisReconciliationSweep(
  deps: WorkerReconciliationSweepDeps,
): StopSweep {
  const schedule =
    deps.schedule ??
    ((callback, interval) => {
      const timer = setInterval(callback, interval)
      timer.unref()

      return () => {
        clearInterval(timer)
      }
    })

  return schedule(() => {
    void reconcileOrphanAnalyses(deps)
  }, ORPHAN_ANALYSIS_RECONCILIATION_INTERVAL_MS)
}

export async function startWorker(): Promise<void> {
  const config = loadConfig(process.env)
  const logger = createLogger({ level: config.logLevel, pretty: config.nodeEnv !== 'production' })
  const app = buildApp({ logger, trustProxy: config.trustProxy })
  const prisma = createPrismaClient({
    databaseUrl: config.databaseUrl,
    logQueries: config.nodeEnv !== 'production',
  })
  const eventBus = new InProcessEventBus(logger)
  const clock = new SystemClock()
  const idGenerator = new UuidGenerator()
  const accountsContainer = createAccountsContainer({
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator,
    config: {
      consentVersion: config.accountsConsentVersion,
      publicApiUrl: config.publicApiUrl,
      publicWebUrl: config.publicWebUrl,
      secureCookies: config.nodeEnv === 'production',
      supabaseUrl: config.supabaseUrl,
      supabaseSecretKey: config.supabaseSecretKey,
      emailConfirmationRedirectUrl: config.emailConfirmationRedirectUrl,
      authRateLimit: {
        max: config.authRateLimitMax,
        timeWindowMs: config.authRateLimitWindowMs,
      },
    },
  })
  const themesContainer = createThemesContainer({
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator,
  })
  const redisConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null })
  const bullMqQueue = new Queue(SESSION_ANALYSIS_QUEUE_NAME, { connection: redisConnection })
  const { sessionsContainer, analysesContainer } = await registerAnalysisPipelineModules(app, {
    sessions: {
      prisma,
      clock,
      eventPublisher: eventBus,
      eventSubscriber: eventBus,
      idGenerator,
      accountsFacade: accountsContainer.facade,
      themesFacade: themesContainer.publicApi,
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
  const analysisWorker = createAnalysisWorker({
    processSessionAudio: analysesContainer.useCases.processSessionAudio,
    concurrency: config.analysisQueueConcurrency,
    createWorker: (processor, options) =>
      new Worker(SESSION_ANALYSIS_QUEUE_NAME, processor, {
        ...options,
        connection: redisConnection,
      }),
  })

  registerHealthRoute(app)
  const stopSweep = registerExpiredSessionSweep({
    sweepExpiredSessions: sessionsContainer.useCases.sweepExpiredSessions,
    logger,
  })
  const stopOrphanAnalysisReconciliation = registerOrphanAnalysisReconciliationSweep({
    reconcileOrphanAnalyses: analysesContainer.useCases.reconcileOrphanAnalyses,
    logger,
  })
  app.addHook('onClose', async () => {
    stopSweep()
    stopOrphanAnalysisReconciliation()
    await bullMqQueue.close()
    await closeAnalysisWorker(analysisWorker, redisConnection)
  })

  await app.listen({ host: config.host, port: config.workerHealthPort })
}

function isWorkerEntrypoint(): boolean {
  const scriptPath = process.argv[1]
  return scriptPath !== undefined && resolve(scriptPath) === fileURLToPath(import.meta.url)
}

if (isWorkerEntrypoint()) await startWorker()
