import {
  Transcription,
  type TranscriptionWord,
} from '@/modules/analyses/domain/entities/transcription/index.js'
import type { TranscriptionRow } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

function isWord(value: unknown): value is TranscriptionWord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'word' in value &&
    typeof value.word === 'string' &&
    'start' in value &&
    typeof value.start === 'number' &&
    'end' in value &&
    typeof value.end === 'number' &&
    'confidence' in value &&
    typeof value.confidence === 'number'
  )
}

function parseWords(value: unknown): readonly TranscriptionWord[] {
  if (!Array.isArray(value) || !value.every(isWord))
    throw new DatabaseError('Invalid persisted transcription words')
  return value
}

export class TranscriptionMapper {
  toDomain(row: TranscriptionRow): Transcription {
    return Transcription.reconstitute({
      transcriptionId: row.id,
      sessionId: row.sessionId,
      text: row.text,
      words: parseWords(row.words),
      averageConfidence: row.averageConfidence,
      durationSeconds: row.durationSeconds,
      createdAt: row.createdAt,
    })
  }
  toData(transcription: Transcription): TranscriptionRow {
    return {
      id: transcription.id,
      sessionId: transcription.sessionId,
      text: transcription.text,
      words: transcription.words,
      averageConfidence: transcription.averageConfidence,
      durationSeconds: transcription.durationSeconds,
      createdAt: transcription.createdAt,
    }
  }
}
