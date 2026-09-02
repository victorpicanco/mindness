import { describe, expect, it } from 'vitest'

import { MalformedEvaluationError } from './index.js'

describe('MalformedEvaluationError', () => {
  it('keeps the diagnostic in context', () => {
    const error = new MalformedEvaluationError('summary')

    expect(error.code).toBe('analyses.MALFORMED_EVALUATION')
    expect(error.httpStatus).toBe(500)
    expect(error.context).toEqual({ field: 'summary' })
    expect(error.message).not.toContain('summary')
  })
})
