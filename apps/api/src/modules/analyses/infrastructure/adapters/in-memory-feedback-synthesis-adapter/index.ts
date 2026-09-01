import { FeedbackSynthesisFailedError } from '@/modules/analyses/domain/errors/feedback-synthesis-failed-error/index.js'
import type {
  FeedbackSynthesisInput,
  FeedbackSynthesisPort,
  FeedbackSynthesisResult,
} from '@/modules/analyses/domain/ports/feedback-synthesis-port/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'

import { parseCommunicationFeedback } from '../gemini-feedback-synthesis-adapter/schemas.js'

export class InMemoryFeedbackSynthesisAdapter implements FeedbackSynthesisPort {
  private failure: BaseError | null = null
  private hangs = false
  private latencyMs = 0
  private response: unknown = undefined
  private hasResponse = false
  readonly received: FeedbackSynthesisInput[] = []

  constructor(private result: FeedbackSynthesisResult) {}

  async synthesize(input: FeedbackSynthesisInput): Promise<FeedbackSynthesisResult> {
    this.received.push(input)
    await this.applySimulation(input.signal)
    if (!this.hasResponse) return this.result

    return {
      feedback: parseCommunicationFeedback(this.response, input.audio.durationSeconds),
      inputTokens: this.result.inputTokens,
      outputTokens: this.result.outputTokens,
    }
  }

  setResult(result: FeedbackSynthesisResult): void {
    this.result = result
  }

  respondWith(payload: unknown): void {
    this.response = payload
    this.hasResponse = true
  }

  failNext(error: BaseError): void {
    this.failure = error
  }

  delayNext(milliseconds: number): void {
    this.latencyMs = milliseconds
  }

  hangUntilAborted(): void {
    this.hangs = true
  }

  reset(): void {
    this.failure = null
    this.hangs = false
    this.latencyMs = 0
    this.response = undefined
    this.hasResponse = false
    this.received.length = 0
  }

  private async applySimulation(signal: AbortSignal): Promise<void> {
    if (this.failure !== null) {
      const failure = this.failure
      this.failure = null
      throw failure
    }
    if (this.latencyMs > 0) {
      const latencyMs = this.latencyMs
      this.latencyMs = 0
      await new Promise<void>((resolve) => setTimeout(resolve, latencyMs))
    }
    if (!this.hangs) return
    this.hangs = false

    await new Promise<void>((_resolve, reject) => {
      if (signal.aborted) {
        reject(new FeedbackSynthesisFailedError('request aborted'))
        return
      }
      signal.addEventListener(
        'abort',
        () => reject(new FeedbackSynthesisFailedError('request aborted')),
        { once: true },
      )
    })
  }
}
