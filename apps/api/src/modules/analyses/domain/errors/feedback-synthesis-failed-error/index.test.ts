import { describe, expect, it } from 'vitest'

import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

import { FeedbackSynthesisFailedError } from './index.js'

describe('FeedbackSynthesisFailedError', () => {
  it('keeps the diagnostic in context', () => {
    const error = new FeedbackSynthesisFailedError('empty response')

    expect(error).toBeInstanceOf(InfrastructureError)
    expect(error.code).toBe('analyses.FEEDBACK_SYNTHESIS_FAILED')
    expect(error.httpStatus).toBe(500)
    expect(error.context).toEqual({ reason: 'empty response' })
    expect(error.message).not.toContain('empty response')
  })

  it('preserves the cause', () => {
    const cause = new TypeError('deadline exceeded')

    expect(new FeedbackSynthesisFailedError('timeout', { cause }).cause).toBe(cause)
  })
})
