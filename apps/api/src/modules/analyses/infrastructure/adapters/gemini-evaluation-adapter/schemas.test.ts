import { describe, expect, it } from 'vitest'

import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'

import { MAX_FILLER_OCCURRENCES } from './prompt.js'
import {
  EvaluationFeedbackSchema,
  parseEvaluationFeedback,
  parseSpeechFeedback,
} from './schemas.js'
import { createDetailedFeedback } from './fixtures.js'

// Largest filler inventory Vertex AI accepted when the whole schema was probed; 20 is refused.
const PROVIDER_OCCURRENCE_CEILING = 16

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

const measurements = {
  durationSeconds: 30,
  wordCount: 60,
  wordsPerMinute: 120,
  windows: [0, 10, 20].map((startSeconds) => ({
    startSeconds,
    endSeconds: startSeconds + 10,
    wordCount: 20,
    wordsPerMinute: 120,
  })),
}

describe('parseEvaluationFeedback', () => {
  it('requires observations for new analyses and derives counts from their evidence', () => {
    const feedback = parseEvaluationFeedback(createDetailedFeedback(), measurements, 'test-model')

    expect(feedback.delivery).toMatchObject({
      version: 2,
      promptVersion: 'speech-feedback-v2',
      model: 'test-model',
      metrics: measurements,
      fillers: { total: 2, perMinute: 4, byExpression: [{ expression: 'é', count: 2 }] },
    })
    expect(parseSpeechFeedback(feedback)).toEqual(feedback)
    expect(() => parseEvaluationFeedback(validFeedback, measurements, 'test-model')).toThrow(
      MalformedEvaluationError,
    )
  })

  it.each([
    'outside recording',
    'reversed interval',
    'duplicate filler',
    'unavailable with occurrences',
    'markup',
    'unusable with coaching',
  ])('rejects %s', (scenario) => {
    const feedback = createDetailedFeedback()
    const [first] = feedback.delivery.fillers.occurrences
    expect(first).toBeDefined()
    if (first === undefined) return
    if (scenario === 'outside recording') first.endSeconds = 31
    if (scenario === 'reversed interval') first.endSeconds = 0
    if (scenario === 'duplicate filler') feedback.delivery.fillers.occurrences.push({ ...first })
    if (scenario === 'unavailable with occurrences')
      feedback.delivery.fillers.status = 'unavailable'
    if (scenario === 'markup') first.quote = '<b>filler</b>'
    if (scenario === 'unusable with coaching') feedback.delivery.audioQuality = 'unusable'

    expect(() => parseEvaluationFeedback(feedback, measurements, 'test-model')).toThrow(
      MalformedEvaluationError,
    )
  })

  it('rejects persisted counts that no longer match occurrences', () => {
    const feedback = parseEvaluationFeedback(createDetailedFeedback(), measurements, 'test-model')
    expect(() =>
      parseSpeechFeedback({
        ...feedback,
        delivery: { ...feedback.delivery, fillers: { ...feedback.delivery?.fillers, total: 99 } },
      }),
    ).toThrow(MalformedEvaluationError)
  })

  it('accepts equivalent JSON object key ordering from persistence', () => {
    const feedback = parseEvaluationFeedback(createDetailedFeedback(), measurements, 'test-model')
    const delivery = feedback.delivery
    expect(delivery).toBeDefined()
    if (delivery === undefined) return
    expect(
      parseSpeechFeedback({
        ...feedback,
        delivery: {
          ...delivery,
          fillers: { ...delivery.fillers, byExpression: [{ count: 2, expression: 'é' }] },
        },
      }),
    ).toEqual(feedback)
  })
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findConstUnions(node: unknown, path = ''): readonly string[] {
  if (Array.isArray(node))
    return node.flatMap((item, index) => findConstUnions(item, `${path}[${index}]`))
  if (!isRecord(node)) return []
  const variants = node.anyOf
  const here =
    Array.isArray(variants) && variants.every((variant) => isRecord(variant) && 'const' in variant)
      ? [path]
      : []
  return [
    ...here,
    ...Object.entries(node).flatMap(([key, value]) => findConstUnions(value, `${path}.${key}`)),
  ]
}

function withOccurrences(count: number, status: string) {
  const feedback = createDetailedFeedback()
  const [first] = feedback.delivery.fillers.occurrences
  if (first === undefined) throw new MalformedEvaluationError('fixture')
  return {
    ...feedback,
    delivery: {
      ...feedback.delivery,
      limitations: ['The inventory stops at the occurrence limit.'],
      fillers: {
        status,
        occurrences: Array.from({ length: count }, (_unused, index) => ({
          ...first,
          startSeconds: index,
          endSeconds: index + 0.5,
        })),
      },
    },
  }
}

describe('EvaluationFeedbackSchema', () => {
  it('states closed enumerations with the enum keyword the provider enforces', () => {
    expect(findConstUnions(EvaluationFeedbackSchema)).toEqual([])
  })

  it('caps the filler inventory within the provider decoding budget', () => {
    expect(MAX_FILLER_OCCURRENCES).toBeLessThanOrEqual(PROVIDER_OCCURRENCE_CEILING)
    expect(() =>
      parseEvaluationFeedback(
        withOccurrences(MAX_FILLER_OCCURRENCES + 1, 'partial'),
        measurements,
        'test-model',
      ),
    ).toThrow(MalformedEvaluationError)
  })

  it('demands the partial status once the inventory reaches the cap', () => {
    expect(() =>
      parseEvaluationFeedback(
        withOccurrences(MAX_FILLER_OCCURRENCES, 'assessed'),
        measurements,
        'test-model',
      ),
    ).toThrow(MalformedEvaluationError)
    expect(
      parseEvaluationFeedback(
        withOccurrences(MAX_FILLER_OCCURRENCES, 'partial'),
        measurements,
        'test-model',
      ).delivery,
    ).toBeDefined()
  })
})
