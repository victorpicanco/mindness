import { NotFoundError } from '@/shared/errors/categories/not-found-error/index.js'

export class AnalysisNotFoundError extends NotFoundError {
  readonly code = 'analyses.ANALYSIS_NOT_FOUND'

  constructor(sessionId: string, reason?: 'transcription_missing') {
    super('Analysis not found', {
      context: reason === undefined ? { sessionId } : { sessionId, reason },
    })
  }
}
