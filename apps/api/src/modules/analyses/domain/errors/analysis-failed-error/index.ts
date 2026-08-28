import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class AnalysisFailedError extends UnprocessableError {
  readonly code = 'analyses.ANALYSIS_FAILED'

  constructor() {
    super('Analysis processing failed')
  }
}
