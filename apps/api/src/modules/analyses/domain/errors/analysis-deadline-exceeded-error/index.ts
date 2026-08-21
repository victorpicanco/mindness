import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class AnalysisDeadlineExceededError extends UnprocessableError {
  readonly code = 'analyses.ANALYSIS_DEADLINE_EXCEEDED'

  constructor(remainingMs: number) {
    super('Analysis deadline was exceeded', { context: { remainingMs } })
  }
}
