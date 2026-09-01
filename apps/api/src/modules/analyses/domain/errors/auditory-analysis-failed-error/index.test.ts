import { describe, expect, it } from 'vitest'

import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

import { AuditoryAnalysisFailedError } from './index.js'

describe('AuditoryAnalysisFailedError', () => {
  it('keeps the diagnostic in context', () => {
    const error = new AuditoryAnalysisFailedError('provider unavailable')

    expect(error).toBeInstanceOf(InfrastructureError)
    expect(error.code).toBe('analyses.AUDITORY_ANALYSIS_FAILED')
    expect(error.httpStatus).toBe(500)
    expect(error.context).toEqual({ reason: 'provider unavailable' })
    expect(error.message).not.toContain('provider unavailable')
  })

  it('preserves the cause', () => {
    const cause = new TypeError('request aborted')

    expect(new AuditoryAnalysisFailedError('aborted', { cause }).cause).toBe(cause)
  })
})
