import type {
  AudioContent,
  AudioReaderPort,
} from '@/modules/analyses/domain/ports/audio-reader-port/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'

const DEFAULT_CONTENT_TYPE = 'audio/webm'
const DEFAULT_DURATION_SECONDS = 30

export class InMemoryAudioReaderAdapter implements AudioReaderPort {
  private readonly contentBySessionId = new Map<string, AudioContent>()
  private failure: BaseError | null = null

  read(sessionId: string): Promise<AudioContent> {
    if (this.failure !== null) {
      const failure = this.failure
      this.failure = null
      return Promise.reject(failure)
    }

    return Promise.resolve(
      this.contentBySessionId.get(sessionId) ?? {
        bytes: Buffer.alloc(0),
        contentType: DEFAULT_CONTENT_TYPE,
        durationSeconds: DEFAULT_DURATION_SECONDS,
      },
    )
  }

  setAudio(
    sessionId: string,
    bytes: Buffer,
    contentType: string = DEFAULT_CONTENT_TYPE,
    durationSeconds: number = DEFAULT_DURATION_SECONDS,
  ): void {
    this.contentBySessionId.set(sessionId, { bytes, contentType, durationSeconds })
  }

  failNext(error: BaseError): void {
    this.failure = error
  }
}
