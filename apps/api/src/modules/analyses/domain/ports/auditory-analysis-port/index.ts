import type { PreparedAudio } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'

import type { AuditoryAnalysisResult } from './types.js'

export const MAX_AUDITORY_LIMITATIONS = 5
export const MAX_AUDITORY_CANDIDATE_EVENTS = 20

export interface AuditoryAnalysisPort {
  observe(input: {
    readonly audio: PreparedAudio
    readonly signal: AbortSignal
  }): Promise<AuditoryAnalysisResult>
}

export type {
  AuditoryAnalysisResult,
  AuditoryCandidateEvent,
  AuditoryObservation,
} from './types.js'
