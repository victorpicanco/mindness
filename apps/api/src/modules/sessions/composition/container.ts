import { ConfirmAudioUploadUseCase } from '@/modules/sessions/application/use-cases/confirm-audio-upload/index.js'
import { ExpireSessionUseCase } from '@/modules/sessions/application/use-cases/expire-session/index.js'
import { GetActiveSessionUseCase } from '@/modules/sessions/application/use-cases/get-active-session/index.js'
import { RequestAudioUploadUrlUseCase } from '@/modules/sessions/application/use-cases/request-audio-upload-url/index.js'
import { ResolveAccountIdentityUseCase } from '@/modules/sessions/application/use-cases/resolve-account-identity/index.js'
import { StartSessionUseCase } from '@/modules/sessions/application/use-cases/start-session/index.js'
import { SweepExpiredSessionsUseCase } from '@/modules/sessions/application/use-cases/sweep-expired-sessions/index.js'
import type { AccountsPort } from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { AudioStoragePort } from '@/modules/sessions/domain/ports/audio-storage-port/index.js'
import type { AudioValidationPort } from '@/modules/sessions/domain/ports/audio-validation-port/index.js'
import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/sessions/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/sessions/domain/ports/id-generator/index.js'
import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { ThemesPort } from '@/modules/sessions/domain/ports/themes-port/index.js'
import type { UnitOfWork } from '@/modules/sessions/domain/ports/unit-of-work/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
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

import { createSessionsFacade, type SessionsFacade } from './facade.js'

const DEFAULT_SWEEP_LIMIT = 100

export interface SessionsSupabaseDatabase {
  readonly public: {
    readonly Tables: Record<string, never>
    readonly Views: Record<string, never>
    readonly Functions: Record<string, never>
  }
}

export interface SessionsAdapterOverrides {
  readonly accounts?: AccountsPort
  readonly audioStorage?: AudioStoragePort
  readonly audioValidation?: AudioValidationPort
  readonly quota?: QuotaPort
  readonly sessions?: SessionsRepository
  readonly themes?: ThemesPort
  readonly unitOfWork?: UnitOfWork
}

export interface SessionsModuleDeps {
  readonly prisma: SessionsPrismaClient & SessionsPrismaTransactionRunner
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly eventPublisher: EventPublisher
  readonly accountsFacade: AccountsIdentityReader
  readonly themesFacade: ThemesEligibilityReader
  readonly quotaFacade: QuotaReservationManager
  readonly supabase: SupabaseAudioStorageClient
  readonly sweepLimit?: number
  readonly adapters?: SessionsAdapterOverrides
}

export function createSessionsContainer(deps: SessionsModuleDeps) {
  const adapters = deps.adapters ?? {}
  const transactionContext = new SessionsTransactionContext()
  const accounts = adapters.accounts ?? new AccountsPortAdapter(deps.accountsFacade)
  const themes = adapters.themes ?? new ThemesPortAdapter(deps.themesFacade)
  const quota = adapters.quota ?? new QuotaPortAdapter(deps.quotaFacade)
  const audioStorage = adapters.audioStorage ?? new SupabaseAudioStorageAdapter(deps.supabase)
  const audioValidation = adapters.audioValidation ?? new FfmpegAudioValidationAdapter()
  const unitOfWork =
    adapters.unitOfWork ?? new PrismaUnitOfWorkAdapter(deps.prisma, transactionContext)
  const sessions =
    adapters.sessions ??
    new PrismaSessionsRepository(deps.prisma, transactionContext, new SessionMapper())

  const expireSession = new ExpireSessionUseCase({
    sessions,
    quota,
    eventPublisher: deps.eventPublisher,
    idGenerator: deps.idGenerator,
    unitOfWork,
    clock: deps.clock,
  })
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
    expireSession,
    getActiveSession: new GetActiveSessionUseCase({
      sessions,
      clock: deps.clock,
      expireSession,
    }),
    requestAudioUploadUrl: new RequestAudioUploadUrlUseCase({ sessions, audioStorage }),
    resolveAccountIdentity: new ResolveAccountIdentityUseCase({ accounts }),
    startSession: new StartSessionUseCase({
      sessions,
      themes,
      quota,
      clock: deps.clock,
      eventPublisher: deps.eventPublisher,
      idGenerator: deps.idGenerator,
      unitOfWork,
      expireSession,
    }),
    sweepExpiredSessions: new SweepExpiredSessionsUseCase({
      sessions,
      expireSession,
      clock: deps.clock,
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
  const facade: SessionsFacade = createSessionsFacade({
    sweepExpiredSessions: useCases.sweepExpiredSessions,
  })

  return { controllers, facade, repositories: { sessions }, useCases }
}

export type SessionsContainer = ReturnType<typeof createSessionsContainer>
