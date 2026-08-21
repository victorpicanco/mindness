import { describe, expect, it } from 'vitest'

import { AnalysisDeadlineExceededError } from './index.js'

describe('AnalysisDeadlineExceededError', () => {
  it('keeps the deadline in context', () => {
    const error = new AnalysisDeadlineExceededError(0)

    expect(error.code).toBe('analyses.ANALYSIS_DEADLINE_EXCEEDED')
    expect(error.httpStatus).toBe(422)
    expect(error.context).toEqual({ remainingMs: 0 })
    expect(error.message).not.toContain('0')
  })
})
