import { describe, expect, it } from 'vitest'

import { AnalysisAuthenticationRejectedError } from './index.js'

describe('AnalysisAuthenticationRejectedError', () => {
  it('does not expose diagnostics', () => {
    const error = new AnalysisAuthenticationRejectedError()

    expect(error.code).toBe('analyses.AUTHENTICATION_REJECTED')
    expect(error.httpStatus).toBe(401)
    expect(error.context).toEqual({})
  })
})
