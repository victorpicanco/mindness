import { describe, expect, it } from 'vitest'

import { InvalidRhythmMetricsError } from './index.js'

describe('InvalidRhythmMetricsError', () => {
  it('keeps the invalid field in context', () => {
    const error = new InvalidRhythmMetricsError('pauseCount')

    expect(error.code).toBe('analyses.INVALID_RHYTHM_METRICS')
    expect(error.httpStatus).toBe(422)
    expect(error.context).toEqual({ field: 'pauseCount' })
    expect(error.message).not.toContain('pauseCount')
  })
})
