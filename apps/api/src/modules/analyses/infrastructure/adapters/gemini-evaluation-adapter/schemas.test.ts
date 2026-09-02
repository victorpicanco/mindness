import { describe, expect, it } from 'vitest'

import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'

import { parseSpeechFeedback } from './schemas.js'

const validFeedback = {
  summary: 'Clear and direct.',
  strengths: [{ title: 'Opening', evidence: 'The message starts immediately.' }],
  improvements: [
    { title: 'Closing', evidence: 'The ending trails off.', action: 'Repeat the main point.' },
  ],
}

describe('parseSpeechFeedback', () => {
  it('accepts the minimal feedback contract', () => {
    expect(parseSpeechFeedback(validFeedback)).toEqual(validFeedback)
  })

  it.each([
    ['an extra property', { ...validFeedback, score: 100 }],
    [
      'too many strengths',
      { ...validFeedback, strengths: Array(4).fill(validFeedback.strengths[0]) },
    ],
    ['empty summary', { ...validFeedback, summary: '' }],
    ['markup', { ...validFeedback, summary: '<b>Clear</b>' }],
  ])('rejects %s', (_description, value) => {
    expect(() => parseSpeechFeedback(value)).toThrow(MalformedEvaluationError)
  })
})
