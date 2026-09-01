import { describe, expect, it } from 'vitest'

import { InvalidCommunicationFeedbackError } from './index.js'

describe('InvalidCommunicationFeedbackError', () => {
  it('keeps the diagnostic in context', () => {
    const error = new InvalidCommunicationFeedbackError('moments[0].id')

    expect(error.code).toBe('analyses.INVALID_COMMUNICATION_FEEDBACK')
    expect(error.httpStatus).toBe(422)
    expect(error.context).toEqual({ field: 'moments[0].id' })
    expect(error.message).not.toContain('moments[0].id')
  })
})
