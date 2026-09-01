import type { SessionsPublicApi } from '@/modules/sessions/index.js'
import type {
  AudioContent,
  AudioReaderPort,
} from '@/modules/analyses/domain/ports/audio-reader-port/index.js'

export type SessionsAudioReader = Pick<SessionsPublicApi, 'downloadAudio'>
export class SessionsAudioReaderAdapter implements AudioReaderPort {
  constructor(private readonly sessions: SessionsAudioReader) {}

  read(sessionId: string): Promise<AudioContent> {
    return this.sessions.downloadAudio(sessionId)
  }
}
