import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class AnalysisTimedOutError extends UnprocessableError {
  readonly code = 'analyses.ANALYSIS_TIMEOUT'

  constructor() {
    super('Analysis processing timed out')
  }
}
