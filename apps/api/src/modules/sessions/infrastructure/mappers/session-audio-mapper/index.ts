import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import type {
  SessionAudioCreateData,
  SessionAudioRow,
  SessionAudioUpdateData,
} from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'

export class SessionAudioMapper {
  toDomain(row: SessionAudioRow): SessionAudio {
    return SessionAudio.create({
      durationSeconds: row.durationSeconds,
      sizeBytes: row.sizeBytes,
      contentType: row.contentType,
      storagePath: row.storagePath,
    })
  }

  toCreateData(sessionId: string, audio: SessionAudio, createdAt: Date): SessionAudioCreateData {
    return {
      id: sessionId,
      durationSeconds: audio.durationSeconds,
      sizeBytes: audio.sizeBytes,
      contentType: audio.contentType,
      storagePath: audio.storagePath,
      createdAt,
    }
  }

  toUpdateData(audio: SessionAudio): SessionAudioUpdateData {
    return {
      durationSeconds: audio.durationSeconds,
      sizeBytes: audio.sizeBytes,
      contentType: audio.contentType,
      storagePath: audio.storagePath,
    }
  }
}
