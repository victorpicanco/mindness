import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'
import type { BaseErrorOptions } from '@/shared/errors/base-error/index.js'

export class AuditoryAnalysisFailedError extends InfrastructureError {
  readonly code = 'analyses.AUDITORY_ANALYSIS_FAILED'

  constructor(reason: string, options?: Pick<BaseErrorOptions, 'cause'>) {
    super('Auditory analysis failed', { context: { reason }, cause: options?.cause })
  }
}
