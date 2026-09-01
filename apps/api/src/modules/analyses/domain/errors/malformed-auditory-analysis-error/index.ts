import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'
import type { BaseErrorOptions } from '@/shared/errors/base-error/index.js'

export class MalformedAuditoryAnalysisError extends InfrastructureError {
  readonly code = 'analyses.MALFORMED_AUDITORY_ANALYSIS'

  constructor(field: string, options?: Pick<BaseErrorOptions, 'cause'>) {
    super('Auditory analysis response is malformed', {
      context: { field },
      cause: options?.cause,
    })
  }
}
