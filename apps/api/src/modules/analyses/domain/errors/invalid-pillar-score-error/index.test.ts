import { describe, expect, it } from 'vitest'

import { InvalidPillarScoreError } from './index.js'

describe('InvalidPillarScoreError', () => {
  it('keeps the invalid value in context', () => {
    const error = new InvalidPillarScoreError(-1)

    expect(error.code).toBe('analyses.INVALID_PILLAR_SCORE')
    expect(error.httpStatus).toBe(422)
    expect(error.context).toEqual({ value: -1 })
    expect(error.message).not.toContain('-1')
  })
})
