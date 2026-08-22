import type { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'

export interface TranscriptionsRepository {
  findBySessionId(sessionId: string): Promise<Transcription | null>
  save(transcription: Transcription): Promise<void>
}
