import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class InvalidRhythmMetricsError extends UnprocessableError {
  readonly code = 'analyses.INVALID_RHYTHM_METRICS'

  constructor(field: string) {
    super('Rhythm metrics are invalid', { context: { field } })
  }
}
