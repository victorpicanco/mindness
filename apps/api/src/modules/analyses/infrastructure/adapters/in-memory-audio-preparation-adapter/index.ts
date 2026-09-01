import { AudioPreparationFailedError } from '@/modules/analyses/domain/errors/audio-preparation-failed-error/index.js'
import type {
  AudioPreparationPort,
  PrepareAudioInput,
  PreparedAudio,
} from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import { CANONICAL_AUDIO_CONTENT_TYPE } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'

export class InMemoryAudioPreparationAdapter implements AudioPreparationPort {
  private failure: BaseError | null = null
  private hangs = false
  private result: PreparedAudio | null = null
  readonly received: PrepareAudioInput[] = []

  async prepare(input: PrepareAudioInput): Promise<PreparedAudio> {
    this.received.push(input)
    await this.applySimulation(input.signal)

    return (
      this.result ?? {
        bytes: Buffer.from('flac'),
        contentType: CANONICAL_AUDIO_CONTENT_TYPE,
        durationSeconds: input.source.durationSeconds,
      }
    )
  }

  setResult(result: PreparedAudio): void {
    this.result = result
  }

  failNext(error: BaseError): void {
    this.failure = error
  }

  hangUntilAborted(): void {
    this.hangs = true
  }

  reset(): void {
    this.failure = null
    this.hangs = false
    this.result = null
    this.received.length = 0
  }

  private async applySimulation(signal: AbortSignal): Promise<void> {
    if (this.failure !== null) {
      const failure = this.failure
      this.failure = null
      throw failure
    }
    if (!this.hangs) return
    this.hangs = false

    await new Promise<void>((_resolve, reject) => {
      if (signal.aborted) {
        reject(new AudioPreparationFailedError('preparation aborted'))
        return
      }
      signal.addEventListener(
        'abort',
        () => reject(new AudioPreparationFailedError('preparation aborted')),
        { once: true },
      )
    })
  }
}
