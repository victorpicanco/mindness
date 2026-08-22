import { describe, expect, it } from 'vitest'

import { AnalysisNotFoundError } from './index.js'

describe('AnalysisNotFoundError', () => {
  it('keeps the session identifier in context', () => {
    const error = new AnalysisNotFoundError('session-id')

    expect(error.code).toBe('analyses.ANALYSIS_NOT_FOUND')
    expect(error.httpStatus).toBe(404)
    expect(error.context).toEqual({ sessionId: 'session-id' })
    expect(error.message).not.toContain('session-id')
  })
})
