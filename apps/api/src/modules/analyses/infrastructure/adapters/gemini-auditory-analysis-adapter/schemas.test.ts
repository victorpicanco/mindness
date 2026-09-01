import { describe, expect, it } from 'vitest'

import { MalformedAuditoryAnalysisError } from '@/modules/analyses/domain/errors/malformed-auditory-analysis-error/index.js'

import { parseAuditoryObservation } from './schemas.js'

const DURATION_SECONDS = 42

const validEvent = {
  startSeconds: 3.5,
  endSeconds: 4.25,
  excerpt: 'ééé então eu acho que',
  category: 'filler',
  auditoryEvidence: 'Som de hesitação prolongado antes da retomada da frase.',
  confidence: 'high',
}

const validObservation = {
  audioUsability: 'usable',
  limitations: ['Ruído de fundo constante na segunda metade.'],
  literalTranscript: 'ééé então eu acho que a comunicação é... é uma habilidade.',
  mainMessage: 'A pessoa defende que comunicação é uma habilidade treinável.',
  attemptedStructure: 'Abertura com definição, um exemplo e um fechamento curto.',
  deliverySummary: 'Ritmo irregular, com quedas de volume no fim das frases.',
  candidateEvents: [validEvent],
}

function withEvents(count: number): unknown {
  return {
    ...validObservation,
    candidateEvents: Array.from({ length: count }, (_item, index) => ({
      ...validEvent,
      startSeconds: index * 0.5,
      endSeconds: index * 0.5 + 0.25,
    })),
  }
}

describe('parseAuditoryObservation', () => {
  it('returns the closed intermediate contract for a valid observation', () => {
    expect(parseAuditoryObservation(validObservation, DURATION_SECONDS)).toEqual(validObservation)
  })

  it('accepts an event ending within the timestamp tolerance', () => {
    const observation = {
      ...validObservation,
      candidateEvents: [{ ...validEvent, startSeconds: 41.9, endSeconds: DURATION_SECONDS + 0.25 }],
    }

    expect(parseAuditoryObservation(observation, DURATION_SECONDS)).toEqual(observation)
  })

  it.each([
    'audioUsability',
    'limitations',
    'literalTranscript',
    'mainMessage',
    'attemptedStructure',
    'deliverySummary',
    'candidateEvents',
  ] as const)('rejects a missing %s field', (field) => {
    const observation = Object.fromEntries(
      Object.entries(validObservation).filter(([key]) => key !== field),
    )

    expect(() => parseAuditoryObservation(observation, DURATION_SECONDS)).toThrow(
      MalformedAuditoryAnalysisError,
    )
  })

  it.each([
    ['an undeclared property', { ...validObservation, extra: 'value' }],
    [
      'an undeclared property inside an event',
      {
        ...validObservation,
        candidateEvents: [{ ...validEvent, score: 90 }],
      },
    ],
    ['an unknown audio usability', { ...validObservation, audioUsability: 'excellent' }],
    [
      'an unknown event category',
      {
        ...validObservation,
        candidateEvents: [{ ...validEvent, category: 'emotion' }],
      },
    ],
    [
      'an unknown event confidence',
      {
        ...validObservation,
        candidateEvents: [{ ...validEvent, confidence: 'certain' }],
      },
    ],
    [
      'more than five limitations',
      {
        ...validObservation,
        limitations: ['a', 'b', 'c', 'd', 'e', 'f'],
      },
    ],
    ['more than twenty candidate events', withEvents(21)],
    ['an empty limitation', { ...validObservation, limitations: [' '] }],
    ['an empty literal transcript', { ...validObservation, literalTranscript: '' }],
    [
      'HTML in the literal transcript',
      {
        ...validObservation,
        literalTranscript: '<script>alert(1)</script>',
      },
    ],
    [
      'a code fence in the delivery summary',
      {
        ...validObservation,
        deliverySummary: '```texto```',
      },
    ],
    [
      'a Markdown link in an event excerpt',
      {
        ...validObservation,
        candidateEvents: [{ ...validEvent, excerpt: '[link](http://x)' }],
      },
    ],
    [
      'an inverted event interval',
      {
        ...validObservation,
        candidateEvents: [{ ...validEvent, startSeconds: 5, endSeconds: 4 }],
      },
    ],
    [
      'a negative event start',
      {
        ...validObservation,
        candidateEvents: [{ ...validEvent, startSeconds: -1, endSeconds: 4 }],
      },
    ],
    [
      'an event ending beyond the audio duration',
      {
        ...validObservation,
        candidateEvents: [{ ...validEvent, startSeconds: 41, endSeconds: DURATION_SECONDS + 1 }],
      },
    ],
  ])('rejects %s', (_description, observation) => {
    expect(() => parseAuditoryObservation(observation, DURATION_SECONDS)).toThrow(
      MalformedAuditoryAnalysisError,
    )
  })

  it('accepts exactly twenty candidate events', () => {
    expect(parseAuditoryObservation(withEvents(20), DURATION_SECONDS)).toEqual(withEvents(20))
  })
})
