import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'
import type {
  EvaluationPort,
  EvaluationResult,
} from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'

import { parseSpeechFeedback } from '../gemini-evaluation-adapter/schemas.js'

type EvaluationInput = Parameters<EvaluationPort['evaluate']>[0]

export class InMemoryEvaluationAdapter implements EvaluationPort {
  private failure: BaseError | null = null
  private hangs = false
  private response: unknown = undefined
  private hasResponse = false
  readonly received: EvaluationInput[] = []

  constructor(private readonly result: EvaluationResult) {}

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    this.received.push(input)
    await this.applySimulation(input.signal)
    if (!this.hasResponse) return this.result

    return {
      feedback: parseSpeechFeedback(this.response),
      inputTokens: this.result.inputTokens,
      outputTokens: this.result.outputTokens,
    }
  }

  failNext(error: BaseError): void {
    this.failure = error
  }

  hangUntilAborted(): void {
    this.hangs = true
  }

  respondWith(payload: unknown): void {
    this.response = payload
    this.hasResponse = true
  }

  reset(): void {
    this.failure = null
    this.hangs = false
    this.response = undefined
    this.hasResponse = false
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
        reject(new EvaluationFailedError('request aborted'))
        return
      }
      signal.addEventListener('abort', () => reject(new EvaluationFailedError('request aborted')), {
        once: true,
      })
    })
  }
}
