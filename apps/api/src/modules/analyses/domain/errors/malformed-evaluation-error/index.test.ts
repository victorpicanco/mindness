import { describe, expect, it } from 'vitest'

import { MalformedEvaluationError } from './index.js'

describe('MalformedEvaluationError', () => {
  it('keeps the diagnostic in context', () => {
    const error = new MalformedEvaluationError('clarityScore')

    expect(error.code).toBe('analyses.MALFORMED_EVALUATION')
    expect(error.httpStatus).toBe(500)
    expect(error.context).toEqual({ field: 'clarityScore' })
    expect(error.message).not.toContain('clarityScore')
  })
})
