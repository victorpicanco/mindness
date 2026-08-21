import { OnRecordingSubmittedEnqueueAnalysis } from '@/modules/analyses/application/event-handlers/on-recording-submitted-enqueue-analysis/index.js'
import { EnqueueSessionAnalysisUseCase } from '@/modules/analyses/application/use-cases/enqueue-session-analysis/index.js'
import { ProcessSessionAudioUseCase } from '@/modules/analyses/application/use-cases/process-session-audio/index.js'
import type { ProcessingCostRates } from '@/modules/analyses/application/use-cases/process-session-audio/types.js'
import type { AccountsPort } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { AnalysisLogger } from '@/modules/analyses/domain/ports/analysis-logger/index.js'
import type { AudioReaderPort } from '@/modules/analyses/domain/ports/audio-reader-port/index.js'
import type { Clock } from '@/modules/analyses/domain/ports/clock/index.js'
import type { EvaluationPort } from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import type { EventPublisher } from '@/modules/analyses/domain/ports/event-publisher/index.js'
import type { EventSubscriber } from '@/modules/analyses/domain/ports/event-subscriber/index.js'
import type { IdGenerator } from '@/modules/analyses/domain/ports/id-generator/index.js'
import type { ProcessingQueuePort } from '@/modules/analyses/domain/ports/processing-queue-port/index.js'
import type { SessionsPort } from '@/modules/analyses/domain/ports/sessions-port/index.js'
import type { ThemesPort } from '@/modules/analyses/domain/ports/themes-port/index.js'
import type { TranscriptionPort } from '@/modules/analyses/domain/ports/transcription-port/index.js'
import type { UnitOfWork } from '@/modules/analyses/domain/ports/unit-of-work/index.js'
import type { AnalysesRepository } from '@/modules/analyses/domain/repositories/analyses-repository/index.js'
import type { AnalysisCostEntriesRepository } from '@/modules/analyses/domain/repositories/analysis-cost-entries-repository/index.js'
import type { TranscriptionsRepository } from '@/modules/analyses/domain/repositories/transcriptions-repository/index.js'
import { PrismaUnitOfWorkAdapter } from '@/modules/analyses/infrastructure/adapters/prisma-unit-of-work-adapter/index.js'
import {
  SessionsAudioReaderAdapter,
  type SessionsAudioReader,
} from '@/modules/analyses/infrastructure/module-adapters/sessions-audio-reader-adapter/index.js'
import {
  SessionsPortAdapter,
  type SessionsProcessingContextReader,
} from '@/modules/analyses/infrastructure/module-adapters/sessions-port-adapter/index.js'
import {
  ThemesPortAdapter,
  type ThemesTitleReader,
} from '@/modules/analyses/infrastructure/module-adapters/themes-port-adapter/index.js'
import { AnalysesTransactionContext } from '@/modules/analyses/infrastructure/clients/analyses-transaction-context/index.js'
import type {
  AnalysesPrismaClient,
  AnalysesPrismaTransactionRunner,
} from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import { AnalysisCostEntryMapper } from '@/modules/analyses/infrastructure/mappers/analysis-cost-entry-mapper/index.js'
import { AnalysisMapper } from '@/modules/analyses/infrastructure/mappers/analysis-mapper/index.js'
import { TranscriptionMapper } from '@/modules/analyses/infrastructure/mappers/transcription-mapper/index.js'
import { PrismaAnalysisCostEntriesRepository } from '@/modules/analyses/infrastructure/repositories/prisma-analysis-cost-entries-repository/index.js'
import { PrismaAnalysesRepository } from '@/modules/analyses/infrastructure/repositories/prisma-analyses-repository/index.js'
import { PrismaTranscriptionsRepository } from '@/modules/analyses/infrastructure/repositories/prisma-transcriptions-repository/index.js'
import { OperationFailedError } from '@/shared/errors/operation-failed-error/index.js'

export interface AnalysesAdapterOverrides {
  readonly accounts?: AccountsPort
  readonly audioReader?: AudioReaderPort
  readonly evaluation?: EvaluationPort
  readonly processingQueue?: ProcessingQueuePort
  readonly sessions?: SessionsPort
  readonly themes?: ThemesPort
  readonly transcription?: TranscriptionPort
  readonly analyses?: AnalysesRepository
  readonly costs?: AnalysisCostEntriesRepository
  readonly transcriptions?: TranscriptionsRepository
  readonly unitOfWork?: UnitOfWork
}

export interface AnalysesModuleDeps {
  readonly prisma?: AnalysesPrismaClient & AnalysesPrismaTransactionRunner
  readonly clock?: Clock
  readonly costRates?: ProcessingCostRates
  readonly idGenerator?: IdGenerator
  readonly eventPublisher?: EventPublisher
  readonly eventSubscriber?: EventSubscriber
  readonly logger?: AnalysisLogger
  readonly accountsFacade?: AccountsPort
  readonly sessionsFacade?: SessionsProcessingContextReader & SessionsAudioReader
  readonly themesFacade?: ThemesTitleReader
  readonly transcription?: TranscriptionPort
  readonly evaluation?: EvaluationPort
  readonly processingQueue?: ProcessingQueuePort
  readonly adapters?: AnalysesAdapterOverrides
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new OperationFailedError('create-analyses-container', {
      context: { missingDependency: name },
    })
  }
  return value
}

export function createAnalysesContainer(deps: AnalysesModuleDeps) {
  const prisma = required(deps.prisma, 'prisma')
  const clock = required(deps.clock, 'clock')
  const idGenerator = required(deps.idGenerator, 'idGenerator')
  const eventPublisher = required(deps.eventPublisher, 'eventPublisher')
  const logger = required(deps.logger, 'logger')
  const adapters = deps.adapters ?? {}
  const transactionContext = new AnalysesTransactionContext()

  const accounts = adapters.accounts ?? required(deps.accountsFacade, 'accountsFacade')
  const sessions =
    adapters.sessions ?? new SessionsPortAdapter(required(deps.sessionsFacade, 'sessionsFacade'))
  const themes =
    adapters.themes ?? new ThemesPortAdapter(required(deps.themesFacade, 'themesFacade'))
  const audioReader =
    adapters.audioReader ??
    new SessionsAudioReaderAdapter(required(deps.sessionsFacade, 'sessionsFacade'))
  const transcription = adapters.transcription ?? required(deps.transcription, 'transcription')
  const evaluation = adapters.evaluation ?? required(deps.evaluation, 'evaluation')
  const processingQueue =
    adapters.processingQueue ?? required(deps.processingQueue, 'processingQueue')
  const unitOfWork = adapters.unitOfWork ?? new PrismaUnitOfWorkAdapter(prisma, transactionContext)
  const analyses =
    adapters.analyses ??
    new PrismaAnalysesRepository(prisma, transactionContext, new AnalysisMapper())
  const transcriptions =
    adapters.transcriptions ??
    new PrismaTranscriptionsRepository(prisma, transactionContext, new TranscriptionMapper())
  const costs =
    adapters.costs ??
    new PrismaAnalysisCostEntriesRepository(
      prisma,
      transactionContext,
      new AnalysisCostEntryMapper(),
    )

  const enqueueSessionAnalysis = new EnqueueSessionAnalysisUseCase({
    accounts,
    clock,
    costs,
    eventPublisher,
    idGenerator,
    logger,
    processingQueue,
  })
  const processSessionAudio = new ProcessSessionAudioUseCase({
    accounts,
    analyses,
    audioReader,
    clock,
    costRates: required(deps.costRates, 'costRates'),
    costs,
    evaluation,
    eventPublisher,
    idGenerator,
    logger,
    sessions,
    themes,
    transcription,
    transcriptions,
    unitOfWork,
  })

  return {
    eventHandlers: {
      onRecordingSubmitted: new OnRecordingSubmittedEnqueueAnalysis(enqueueSessionAnalysis, logger),
    },
    repositories: { analyses, costs, transcriptions },
    useCases: { enqueueSessionAnalysis, processSessionAudio },
  }
}

export type AnalysesContainer = ReturnType<typeof createAnalysesContainer>
