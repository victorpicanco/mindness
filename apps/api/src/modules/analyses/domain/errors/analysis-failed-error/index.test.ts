import { describe, expect, it } from 'vitest'

import { AnalysisFailedError } from './index.js'

describe('AnalysisFailedError', () => {
  it('identifies a terminal processing failure', () => {
    const error = new AnalysisFailedError()

    expect(error.code).toBe('analyses.ANALYSIS_FAILED')
    expect(error.httpStatus).toBe(422)
  })
})
