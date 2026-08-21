import { describe, expect, it } from 'vitest'

import { InvalidPillarScoreError } from '@/modules/analyses/domain/errors/invalid-pillar-score-error/index.js'

import { PillarScore } from './index.js'

describe('PillarScore', () => {
  it.each([0, 1, 50, 99, 100])('creates an integer score within the allowed range: %i', (value) => {
    expect(PillarScore.create(value).value).toBe(value)
  })

  it.each([-1, 101, 3.5, Number.NaN])('rejects an invalid score: %s', (value) => {
    expect(() => PillarScore.create(value)).toThrow(InvalidPillarScoreError)
  })

  it('compares scores by their value', () => {
    expect(PillarScore.create(50).equals(PillarScore.create(50))).toBe(true)
    expect(PillarScore.create(50).equals(PillarScore.create(51))).toBe(false)
  })
})
