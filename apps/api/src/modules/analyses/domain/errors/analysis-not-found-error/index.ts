import { NotFoundError } from '@/shared/errors/categories/not-found-error/index.js'

export class AnalysisNotFoundError extends NotFoundError {
  readonly code = 'analyses.ANALYSIS_NOT_FOUND'

  constructor(sessionId: string) {
    super('Analysis not found', { context: { sessionId } })
  }
}
