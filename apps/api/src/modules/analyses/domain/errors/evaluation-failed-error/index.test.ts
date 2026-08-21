import { describe, expect, it } from 'vitest'

import { EvaluationFailedError } from './index.js'

describe('EvaluationFailedError', () => {
  it('keeps the diagnostic in context', () => {
    const error = new EvaluationFailedError('provider unavailable')

    expect(error.code).toBe('analyses.EVALUATION_FAILED')
    expect(error.httpStatus).toBe(500)
    expect(error.context).toEqual({ reason: 'provider unavailable' })
    expect(error.message).not.toContain('provider unavailable')
  })
})
