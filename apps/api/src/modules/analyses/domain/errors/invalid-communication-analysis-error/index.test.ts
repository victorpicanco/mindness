import { describe, expect, it } from 'vitest'

import { InvalidCommunicationAnalysisError } from './index.js'

describe('InvalidCommunicationAnalysisError', () => {
  it('keeps the diagnostic in context', () => {
    const error = new InvalidCommunicationAnalysisError('feedbackVersion')

    expect(error.code).toBe('analyses.INVALID_COMMUNICATION_ANALYSIS')
    expect(error.httpStatus).toBe(422)
    expect(error.context).toEqual({ field: 'feedbackVersion' })
    expect(error.message).not.toContain('feedbackVersion')
  })
})
