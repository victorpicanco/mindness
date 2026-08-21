import type { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import type { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import type { AccountsPort } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { AudioReaderPort } from '@/modules/analyses/domain/ports/audio-reader-port/index.js'
import type { Clock } from '@/modules/analyses/domain/ports/clock/index.js'
import type { EvaluationPort } from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import type { EventPublisher } from '@/modules/analyses/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/analyses/domain/ports/id-generator/index.js'
import type { SessionsPort } from '@/modules/analyses/domain/ports/sessions-port/index.js'
import type { ThemesPort } from '@/modules/analyses/domain/ports/themes-port/index.js'
import type { TranscriptionPort } from '@/modules/analyses/domain/ports/transcription-port/index.js'
import type { UnitOfWork } from '@/modules/analyses/domain/ports/unit-of-work/index.js'
import type { AnalysesRepository } from '@/modules/analyses/domain/repositories/analyses-repository/index.js'
import type {
  AnalysisCostEntriesRepository,
  AnalysisCostEntry,
} from '@/modules/analyses/domain/repositories/analysis-cost-entries-repository/index.js'
import type { TranscriptionsRepository } from '@/modules/analyses/domain/repositories/transcriptions-repository/index.js'

export interface ProcessingCostRates {
  readonly transcriptionCostPerMinuteMicros: number
  readonly geminiInputCostPerMtokMicros: number
  readonly geminiOutputCostPerMtokMicros: number
}

export interface ProcessSessionAudioDependencies {
  readonly accounts: AccountsPort
  readonly analyses: AnalysesRepository
  readonly audioReader: AudioReaderPort
  readonly clock: Clock
  readonly costRates: ProcessingCostRates
  readonly costs: AnalysisCostEntriesRepository
  readonly evaluation: EvaluationPort
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly sessions: SessionsPort
  readonly themes: ThemesPort
  readonly transcription: TranscriptionPort
  readonly transcriptions: TranscriptionsRepository
  readonly unitOfWork: UnitOfWork
}

export interface ProcessSessionAudioInput {
  readonly sessionId: string
}

export type ProcessSessionAudioOutput = void

export interface PersistedAnalysis {
  readonly analysis: Analysis
  readonly costEntry: AnalysisCostEntry
  readonly transcription: Transcription
}
