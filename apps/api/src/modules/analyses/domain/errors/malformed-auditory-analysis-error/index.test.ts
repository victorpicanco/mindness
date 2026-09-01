import { describe, expect, it } from 'vitest'

import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

import { MalformedAuditoryAnalysisError } from './index.js'

describe('MalformedAuditoryAnalysisError', () => {
  it('keeps the diagnostic in context', () => {
    const error = new MalformedAuditoryAnalysisError('candidateEvents')

    expect(error).toBeInstanceOf(InfrastructureError)
    expect(error.code).toBe('analyses.MALFORMED_AUDITORY_ANALYSIS')
    expect(error.httpStatus).toBe(500)
    expect(error.context).toEqual({ field: 'candidateEvents' })
    expect(error.message).not.toContain('candidateEvents')
  })

  it('preserves the cause', () => {
    const cause = new TypeError('unexpected token')

    expect(new MalformedAuditoryAnalysisError('literalTranscript', { cause }).cause).toBe(cause)
  })
})
