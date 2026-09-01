import type { AccountsPort } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { AnalysisLogger } from '@/modules/analyses/domain/ports/analysis-logger/index.js'
import type { AudioPreparationPort } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import type { AudioReaderPort } from '@/modules/analyses/domain/ports/audio-reader-port/index.js'
import type { AuditoryAnalysisPort } from '@/modules/analyses/domain/ports/auditory-analysis-port/index.js'
import type { Clock } from '@/modules/analyses/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/analyses/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/analyses/domain/ports/id-generator/index.js'
import type { SessionsPort } from '@/modules/analyses/domain/ports/sessions-port/index.js'
import type { ThemesPort } from '@/modules/analyses/domain/ports/themes-port/index.js'
import type { TranscriptionPort } from '@/modules/analyses/domain/ports/transcription-port/index.js'
import type { CommunicationAnalysesRepository } from '@/modules/analyses/domain/repositories/communication-analyses-repository/index.js'

export interface ProcessMultimodalSessionAudioDependencies {
  readonly accounts: AccountsPort
  readonly audioPreparation: AudioPreparationPort
  readonly audioReader: AudioReaderPort
  readonly auditoryAnalysis: AuditoryAnalysisPort
  readonly clock: Clock
  readonly communicationAnalyses: CommunicationAnalysesRepository
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly logger: AnalysisLogger
  readonly sessions: SessionsPort
  readonly themes: ThemesPort
  readonly transcription: TranscriptionPort
}

export interface ProcessMultimodalSessionAudioInput {
  readonly sessionId: string
}

export type ProcessMultimodalSessionAudioOutput = void
