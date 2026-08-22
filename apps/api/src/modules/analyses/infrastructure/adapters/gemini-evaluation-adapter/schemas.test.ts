import { describe, expect, it } from 'vitest'

import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'

import { parseEvaluationResult } from './schemas.js'

const validResult = {
  clarityScore: 82,
  clarityGuidance: 'Sua explicação ficou clara e bem organizada.',
  fluencyScore: 75,
  fluencyGuidance: 'Mantenha frases curtas para ganhar fluidez.',
  masteryScore: 91,
  masteryGuidance: 'Você demonstrou domínio consistente do assunto.',
}

describe('parseEvaluationResult', () => {
  it.each([
    'clarityScore',
    'clarityGuidance',
    'fluencyScore',
    'fluencyGuidance',
    'masteryScore',
    'masteryGuidance',
  ] as const)('rejects a missing %s field', (field) => {
    const result = Object.fromEntries(Object.entries(validResult).filter(([key]) => key !== field))

    expect(() => parseEvaluationResult(result)).toThrow(MalformedEvaluationError)
  })

  it.each([
    ['score above the range', { ...validResult, clarityScore: 101 }],
    ['score below the range', { ...validResult, clarityScore: -1 }],
    ['non-integer score', { ...validResult, clarityScore: 82.5 }],
    ['empty guidance', { ...validResult, clarityGuidance: '' }],
    ['guidance longer than 600 characters', { ...validResult, clarityGuidance: 'a'.repeat(601) }],
    ['script HTML guidance', { ...validResult, clarityGuidance: '<script>alert(1)</script>' }],
    ['HTML tag guidance', { ...validResult, clarityGuidance: '<b>texto</b>' }],
    ['code fence guidance', { ...validResult, clarityGuidance: '```texto```' }],
    ['Markdown link guidance', { ...validResult, clarityGuidance: '[link](http://x)' }],
    ['undeclared property', { ...validResult, extra: 'value' }],
  ])('rejects %s', (_description, result) => {
    expect(() => parseEvaluationResult(result)).toThrow(MalformedEvaluationError)
  })

  it('returns a valid six-field evaluation result', () => {
    expect(parseEvaluationResult(validResult)).toEqual(validResult)
  })
})
