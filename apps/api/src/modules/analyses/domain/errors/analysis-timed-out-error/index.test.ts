import { describe, expect, it } from 'vitest'

import { AnalysisTimedOutError } from './index.js'

describe('AnalysisTimedOutError', () => {
  it('identifies a terminal processing timeout', () => {
    const error = new AnalysisTimedOutError()

    expect(error.code).toBe('analyses.ANALYSIS_TIMEOUT')
    expect(error.httpStatus).toBe(422)
  })
})
