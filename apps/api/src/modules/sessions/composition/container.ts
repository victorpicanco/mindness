import { ConfirmAudioUploadUseCase } from '@/modules/sessions/application/use-cases/confirm-audio-upload/index.js'
import { DownloadSessionAudioUseCase } from '@/modules/sessions/application/use-cases/download-session-audio/index.js'
import { ExpireSessionUseCase } from '@/modules/sessions/application/use-cases/expire-session/index.js'
import { FindSessionProcessingContextUseCase } from '@/modules/sessions/application/use-cases/find-session-processing-context/index.js'
import { GetActiveSessionUseCase } from '@/modules/sessions/application/use-cases/get-active-session/index.js'
import { ListStuckProcessingSessionsUseCase } from '@/modules/sessions/application/use-cases/list-stuck-processing-sessions/index.js'
import { RequestAudioUploadUrlUseCase } from '@/modules/sessions/application/use-cases/request-audio-upload-url/index.js'
import { ResolveAccountIdentityUseCase } from '@/modules/sessions/application/use-cases/resolve-account-identity/index.js'
import { StartSessionUseCase } from '@/modules/sessions/application/use-cases/start-session/index.js'
import { SweepExpiredSessionsUseCase } from '@/modules/sessions/application/use-cases/sweep-expired-sessions/index.js'
import type { AccountsPort } from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { AudioStoragePort } from '@/modules/sessions/domain/ports/audio-storage-port/index.js'
import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/sessions/domain/ports/event-publisher/index.js'
import type { EventSubscriber } from '@/modules/sessions/domain/ports/event-subscriber/index.js'
import type { IdGenerator } from '@/modules/sessions/domain/ports/id-generator/index.js'
import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { ThemesPort } from '@/modules/sessions/domain/ports/themes-port/index.js'
import { FfmpegAudioValidationAdapter } from '@/modules/sessions/infrastructure/adapters/ffmpeg-audio-validation-adapter/index.js'
import { PrismaUnitOfWorkAdapter } from '@/modules/sessions/infrastructure/adapters/prisma-unit-of-work-adapter/index.js'
import {
  SupabaseAudioStorageAdapter,
  type SupabaseAudioStorageClient,
} from '@/modules/sessions/infrastructure/adapters/supabase-audio-storage-adapter/index.js'
import type {
  SessionsPrismaClient,
  SessionsPrismaTransactionRunner,
} from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'
import { SessionsTransactionContext } from '@/modules/sessions/infrastructure/clients/sessions-transaction-context/index.js'
import { SessionAudioMapper } from '@/modules/sessions/infrastructure/mappers/session-audio-mapper/index.js'
import { SessionMapper } from '@/modules/sessions/infrastructure/mappers/session-mapper/index.js'
import {
  AccountsPortAdapter,
  type AccountsIdentityReader,
} from '@/modules/sessions/infrastructure/module-adapters/accounts-port-adapter/index.js'
import {
  QuotaPortAdapter,
  type QuotaReservationManager,
} from '@/modules/sessions/infrastructure/module-adapters/quota-port-adapter/index.js'
import {
  ThemesPortAdapter,
  type ThemesEligibilityReader,
} from '@/modules/sessions/infrastructure/module-adapters/themes-port-adapter/index.js'
import { PrismaSessionsRepository } from '@/modules/sessions/infrastructure/repositories/prisma-sessions-repository/index.js'
import { AbandonSessionController } from '@/modules/sessions/presentation/controllers/abandon-session-controller/index.js'
import { ConfirmAudioUploadController } from '@/modules/sessions/presentation/controllers/confirm-audio-upload-controller/index.js'
import { GetActiveSessionController } from '@/modules/sessions/presentation/controllers/get-active-session-controller/index.js'
import { ReportMicrophonePermissionDeniedController } from '@/modules/sessions/presentation/controllers/report-microphone-permission-denied-controller/index.js'
import { RequestAudioUploadUrlController } from '@/modules/sessions/presentation/controllers/request-audio-upload-url-controller/index.js'
import { StartSessionController } from '@/modules/sessions/presentation/controllers/start-session-controller/index.js'
import type { SessionsControllers } from '@/modules/sessions/presentation/routes/sessions-routes/types.js'
import { OperationFailedError } from '@/shared/errors/operation-failed-error/index.js'

const DEFAULT_SWEEP_LIMIT = 100

export interface SessionsAdapterOverrides {
  readonly accounts?: AccountsPort
  readonly audioStorage?: AudioStoragePort
  readonly quota?: QuotaPort
  readonly themes?: ThemesPort
}

export interface SessionsModuleDeps {
  readonly prisma: SessionsPrismaClient & SessionsPrismaTransactionRunner
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly eventPublisher: EventPublisher
  readonly eventSubscriber: EventSubscriber
  // Each neighbour arrives either as the facade the bootstrap owns or, in tests, as the port
  // itself through `adapters` — never as both, and never as a throwaway stub.
  readonly accountsFacade?: AccountsIdentityReader
  readonly themesFacade?: ThemesEligibilityReader
  readonly quotaFacade?: QuotaReservationManager
  readonly supabase?: SupabaseAudioStorageClient
  readonly sweepLimit?: number
  readonly adapters?: SessionsAdapterOverrides
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new OperationFailedError('create-sessions-container', {
      context: { missingDependency: name },
    })
  }

  return value
}

export function createSessionsContainer(deps: SessionsModuleDeps) {
  const adapters = deps.adapters ?? {}
  const transactionContext = new SessionsTransactionContext()
  const accounts =
    adapters.accounts ?? new AccountsPortAdapter(required(deps.accountsFacade, 'accountsFacade'))
  const themes =
    adapters.themes ?? new ThemesPortAdapter(required(deps.themesFacade, 'themesFacade'))
  const quota = adapters.quota ?? new QuotaPortAdapter(required(deps.quotaFacade, 'quotaFacade'))
  const audioStorage =
    adapters.audioStorage ?? new SupabaseAudioStorageAdapter(required(deps.supabase, 'supabase'))
  const audioValidation = new FfmpegAudioValidationAdapter()
  const unitOfWork = new PrismaUnitOfWorkAdapter(deps.prisma, transactionContext)
  const sessions = new PrismaSessionsRepository(
    deps.prisma,
    transactionContext,
    new SessionMapper(new SessionAudioMapper()),
  )

  const expirationDependencies = {
    sessions,
    quota,
    clock: deps.clock,
    eventPublisher: deps.eventPublisher,
    idGenerator: deps.idGenerator,
    unitOfWork,
  }
  const useCases = {
    confirmAudioUpload: new ConfirmAudioUploadUseCase({
      sessions,
      audioStorage,
      audioValidation,
      eventPublisher: deps.eventPublisher,
      idGenerator: deps.idGenerator,
      clock: deps.clock,
      unitOfWork,
    }),
    downloadAudio: new DownloadSessionAudioUseCase({ sessions, audioStorage }),
    expireSession: new ExpireSessionUseCase(expirationDependencies),
    findProcessingContext: new FindSessionProcessingContextUseCase({ sessions }),
    getActiveSession: new GetActiveSessionUseCase(expirationDependencies),
    listStuckProcessingSessions: new ListStuckProcessingSessionsUseCase({ sessions }),
    requestAudioUploadUrl: new RequestAudioUploadUrlUseCase({
      sessions,
      audioStorage,
      clock: deps.clock,
    }),
    resolveAccountIdentity: new ResolveAccountIdentityUseCase({ accounts }),
    startSession: new StartSessionUseCase({ ...expirationDependencies, themes }),
    sweepExpiredSessions: new SweepExpiredSessionsUseCase({
      ...expirationDependencies,
      defaultLimit: deps.sweepLimit ?? DEFAULT_SWEEP_LIMIT,
    }),
  }

  const controllers: SessionsControllers = {
    startSession: new StartSessionController(useCases.startSession),
    getActiveSession: new GetActiveSessionController(useCases.getActiveSession),
    abandonSession: new AbandonSessionController(useCases.expireSession),
    reportMicrophonePermissionDenied: new ReportMicrophonePermissionDeniedController(
      useCases.expireSession,
    ),
    requestAudioUploadUrl: new RequestAudioUploadUrlController(useCases.requestAudioUploadUrl),
    confirmAudioUpload: new ConfirmAudioUploadController(useCases.confirmAudioUpload),
  }
  return { controllers, useCases, repositories: { sessions }, ports: { quota } }
}

export type SessionsContainer = ReturnType<typeof createSessionsContainer>
