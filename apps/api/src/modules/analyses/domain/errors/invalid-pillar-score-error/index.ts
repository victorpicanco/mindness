import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class InvalidPillarScoreError extends UnprocessableError {
  readonly code = 'analyses.INVALID_PILLAR_SCORE'

  constructor(value: number) {
    super('Pillar score is invalid', { context: { value } })
  }
}
