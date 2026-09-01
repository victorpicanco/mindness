import type { PrismaClient } from '@/generated/prisma/client.js'
import type { DestinationStream } from 'pino'
import type { AnalysisLogger } from '@/modules/analyses/domain/ports/analysis-logger/index.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'

import { registerAnalysesModule } from './register.js'
import type { AnalysesContainer } from './container.js'
import { createAnalysesPrismaClient } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import {
  createFakeAccountsPort,
  createFakeSessionsPort,
  createFakeThemesPort,
  createIntegrationAuditoryResult,
  createIntegrationSynthesisResult,
  InMemoryAudioPreparationAdapter,
  InMemoryAudioReaderAdapter,
  InMemoryAuditoryAnalysisAdapter,
  InMemoryEvaluationAdapter,
  InMemoryFeedbackSynthesisAdapter,
  InMemoryProcessingQueueAdapter,
  InMemoryTranscriptionAdapter,
  type FakeAccountsPort,
  type FakeSessionsPort,
  type FakeThemesPort,
} from './integration-fixtures.js'
import type { AnalysisPipelineVersion } from './container.js'

export const ANALYSES_TEST_NOW = new Date('2026-08-16T12:00:00.000Z')

export interface AnalysesIntegrationDeps {
  readonly databaseUrl: string
  readonly pipelineVersion?: AnalysisPipelineVersion
}

export interface AnalysesIntegrationContainer {
  readonly app: ReturnType<typeof buildApp>
  readonly prisma: PrismaClient
  readonly container: AnalysesContainer
  readonly repositories: AnalysesContainer['repositories']
  readonly eventBus: FakeEventBus
  readonly clock: ControllableClock
  readonly accounts: FakeAccountsPort
  readonly sessions: FakeSessionsPort
  readonly themes: FakeThemesPort
  readonly audioPreparation: InMemoryAudioPreparationAdapter
  readonly audioReader: InMemoryAudioReaderAdapter
  readonly auditoryAnalysis: InMemoryAuditoryAnalysisAdapter
  readonly transcription: InMemoryTranscriptionAdapter
  readonly evaluation: InMemoryEvaluationAdapter
  readonly feedbackSynthesis: InMemoryFeedbackSynthesisAdapter
  readonly processingQueue: InMemoryProcessingQueueAdapter
  readonly logger: IntegrationAnalysisLogger
  readonly logs: readonly string[]
  reset(): void
  close(): Promise<void>
}

class IntegrationAnalysisLogger implements AnalysisLogger {
  readonly messages: {
    readonly context: Record<string, string | number>
    readonly message: string
  }[] = []

  warn(context: Record<string, string | number>, message: string): void {
    this.messages.push({ context, message })
  }
}

export async function createAnalysesIntegrationContainer(
  deps: AnalysesIntegrationDeps,
): Promise<AnalysesIntegrationContainer> {
  const logs: string[] = []
  const destination: DestinationStream = {
    write: (chunk) => {
      logs.push(...chunk.split('\n').filter(Boolean))
    },
  }
  const app = buildApp({ logger: createLogger({ level: 'debug', pretty: false }, destination) })
  const prisma = createPrismaClient({ databaseUrl: deps.databaseUrl, logQueries: false })
  const analysesPrisma = createAnalysesPrismaClient(prisma)
  const eventBus = new FakeEventBus()
  const clock = new ControllableClock(ANALYSES_TEST_NOW)
  const accounts = createFakeAccountsPort()
  const sessions = createFakeSessionsPort()
  const themes = createFakeThemesPort()
  const audioPreparation = new InMemoryAudioPreparationAdapter()
  const audioReader = new InMemoryAudioReaderAdapter()
  const auditoryAnalysis = new InMemoryAuditoryAnalysisAdapter(createIntegrationAuditoryResult())
  const feedbackSynthesis = new InMemoryFeedbackSynthesisAdapter(createIntegrationSynthesisResult())
  const transcription = new InMemoryTranscriptionAdapter({
    text: 'Transcript',
    words: [{ word: 'Transcript', start: 0, end: 1, confidence: 1 }],
    averageConfidence: 1,
    durationSeconds: 1,
  })
  const evaluation = new InMemoryEvaluationAdapter({
    clarityScore: 80,
    clarityGuidance: 'Clear',
    fluencyScore: 80,
    fluencyGuidance: 'Fluid',
    masteryScore: 80,
    masteryGuidance: 'Strong',
    inputTokens: 1,
    outputTokens: 1,
  })
  const processingQueue = new InMemoryProcessingQueueAdapter()
  const logger = new IntegrationAnalysisLogger()
  const container = await registerAnalysesModule(app, {
    prisma: analysesPrisma,
    pipelineVersion: deps.pipelineVersion ?? 'v1',
    clock,
    costRates: {
      transcriptionCostPerMinuteMicros: 1,
      geminiInputCostPerMtokMicros: 1,
      geminiOutputCostPerMtokMicros: 1,
    },
    idGenerator: new UuidGenerator(),
    eventPublisher: eventBus,
    eventSubscriber: eventBus,
    logger,
    adapters: {
      accounts,
      sessions,
      audioPreparation,
      audioReader,
      auditoryAnalysis,
      themes,
      transcription,
      evaluation,
      feedbackSynthesis,
      processingQueue,
    },
  })
  await app.ready()

  return {
    app,
    prisma,
    container,
    repositories: container.repositories,
    eventBus,
    clock,
    accounts,
    sessions,
    themes,
    audioPreparation,
    audioReader,
    auditoryAnalysis,
    transcription,
    evaluation,
    feedbackSynthesis,
    processingQueue,
    logger,
    logs,
    reset: () => {
      logs.length = 0
      eventBus.published.length = 0
      clock.set(ANALYSES_TEST_NOW)
      accounts.reset()
      sessions.reset()
      themes.reset()
      processingQueue.enqueued.length = 0
      evaluation.reset()
      audioPreparation.reset()
      auditoryAnalysis.reset()
      feedbackSynthesis.reset()
      logger.messages.length = 0
    },
    close: async () => {
      await app.close()
      await prisma.$disconnect()
    },
  }
}
