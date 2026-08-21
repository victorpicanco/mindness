import { AnalysisDeadlineExceededError } from '@/modules/analyses/domain/errors/analysis-deadline-exceeded-error/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'
import type {
  EvaluationPort,
  EvaluationResult,
} from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import type { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'

import { parseEvaluationResult } from '../gemini-evaluation-adapter/schemas.js'

export class InMemoryEvaluationAdapter implements EvaluationPort {
  private failure: BaseError | null = null
  private hangs = false
  private response: unknown = undefined
  private hasResponse = false
  readonly received: {
    readonly themeTitle: string
    readonly transcript: string
    readonly rhythm: RhythmMetrics
    readonly signal: AbortSignal
  }[] = []

  constructor(private readonly result: EvaluationResult) {}

  async evaluate(input: {
    readonly themeTitle: string
    readonly transcript: string
    readonly rhythm: RhythmMetrics
    readonly signal: AbortSignal
  }): Promise<EvaluationResult> {
    this.received.push(input)
    await this.applySimulation(input.signal)
    if (!this.hasResponse) return this.result

    return {
      ...parseEvaluationResult(this.response),
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
        reject(new AnalysisDeadlineExceededError(0))
        return
      }
      signal.addEventListener('abort', () => reject(new AnalysisDeadlineExceededError(0)), {
        once: true,
      })
    })
  }
}
