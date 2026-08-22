import type { AudioReaderPort } from '@/modules/analyses/domain/ports/audio-reader-port/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'

export class InMemoryAudioReaderAdapter implements AudioReaderPort {
  private readonly audioBySessionId = new Map<string, Buffer>()
  private failure: BaseError | null = null

  read(sessionId: string): Promise<Buffer> {
    if (this.failure !== null) {
      const failure = this.failure
      this.failure = null
      return Promise.reject(failure)
    }
    return Promise.resolve(this.audioBySessionId.get(sessionId) ?? Buffer.alloc(0))
  }

  setAudio(sessionId: string, audio: Buffer): void {
    this.audioBySessionId.set(sessionId, audio)
  }

  failNext(error: BaseError): void {
    this.failure = error
  }
}
