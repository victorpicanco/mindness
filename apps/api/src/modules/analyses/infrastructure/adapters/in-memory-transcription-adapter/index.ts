import { AnalysisDeadlineExceededError } from '@/modules/analyses/domain/errors/analysis-deadline-exceeded-error/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'
import type {
  TranscriptionPort,
  TranscriptionResult,
} from '@/modules/analyses/domain/ports/transcription-port/index.js'

export class InMemoryTranscriptionAdapter implements TranscriptionPort {
  private failure: BaseError | null = null
  private hangs = false
  readonly received: {
    readonly audio: Buffer
    readonly deadlineMs: number
    readonly signal: AbortSignal
  }[] = []

  constructor(private readonly result: TranscriptionResult) {}

  async transcribe(input: {
    readonly audio: Buffer
    readonly deadlineMs: number
    readonly signal: AbortSignal
  }): Promise<TranscriptionResult> {
    this.received.push(input)
    await this.applySimulation(input.signal, input.deadlineMs)
    return this.result
  }

  failNext(error: BaseError): void {
    this.failure = error
  }

  hangUntilAborted(): void {
    this.hangs = true
  }

  private async applySimulation(signal: AbortSignal, deadlineMs: number): Promise<void> {
    if (this.failure !== null) {
      const failure = this.failure
      this.failure = null
      throw failure
    }
    if (!this.hangs) return
    this.hangs = false

    await new Promise<void>((_resolve, reject) => {
      if (signal.aborted) {
        reject(new AnalysisDeadlineExceededError(deadlineMs))
        return
      }
      signal.addEventListener(
        'abort',
        () => reject(new AnalysisDeadlineExceededError(deadlineMs)),
        {
          once: true,
        },
      )
    })
  }
}
