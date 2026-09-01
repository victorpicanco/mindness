import { describe, expect, it } from 'vitest'

import { InvalidCommunicationFeedbackError } from '@/modules/analyses/domain/errors/invalid-communication-feedback-error/index.js'

import {
  ALIGNMENT_QUALITIES,
  AUDIO_USABILITIES,
  CommunicationFeedback,
  FEEDBACK_CONFIDENCES,
  MOMENT_CATEGORIES,
  MOMENT_VALENCES,
  TIMING_BASES,
} from './index.js'
import type {
  CreateCommunicationFeedbackParams,
  FeedbackMoment,
  ImprovementPriority,
  RecurringPattern,
  StrengthPoint,
} from './types.js'

const firstMoment: FeedbackMoment = {
  id: 'M1',
  startSeconds: 3.2,
  endSeconds: 4.1,
  timingBasis: 'asr',
  excerpt: 'entao eu acho que',
  observation: 'A long filler stretches before the main point.',
  impact: 'The idea sounds less certain than it is.',
  nextAttempt: 'Hold a silent pause instead of filling the gap.',
  clearerAlternative: 'Entao, o ponto principal e este.',
  categories: ['filler'],
  valence: 'negative',
  confidence: 'high',
}

const secondMoment: FeedbackMoment = {
  id: 'M2',
  startSeconds: 11,
  endSeconds: 12.4,
  timingBasis: 'audio',
  excerpt: 'eee o segundo ponto',
  observation: 'The same filler opens the second argument.',
  impact: 'The opening loses strength.',
  nextAttempt: 'Start the sentence on the noun.',
  clearerAlternative: null,
  categories: ['filler', 'prolongation'],
  valence: 'negative',
  confidence: 'medium',
}

const strength: StrengthPoint = {
  title: 'Clear closing',
  evidence: 'The last sentence repeats the thesis in five words.',
  whyItHelped: 'The listener leaves with the main idea.',
}

const pattern: RecurringPattern = {
  title: 'Filler before every argument',
  description: 'Both arguments open with a stretched filler.',
  evidenceMomentIds: ['M1', 'M2'],
  impact: 'The start of each idea sounds hesitant.',
  exercise: 'Read a paragraph aloud starting each sentence after a silent breath.',
}

const priority: ImprovementPriority = {
  title: 'Replace the opening filler',
  behavior: 'Starting an argument with a stretched vowel.',
  evidenceMomentIds: ['M1', 'M2'],
  importance: 'It is the most frequent pattern of this attempt.',
  action: 'Breathe before starting the sentence.',
  exercise: 'Record three openings without any filler.',
}

const validParams: CreateCommunicationFeedbackParams = {
  durationSeconds: 42.5,
  audioUsability: 'usable',
  alignmentQuality: 'reliable',
  limitations: ['Background noise hides the end of the last sentence.'],
  literalTranscript: 'entao eee eu acho que o ponto principal e este',
  mainMessage: 'The speaker defends remote work with two arguments.',
  attemptedStructure: 'Opening, two arguments and a closing sentence.',
  summary: 'The message arrives complete and in order. Fillers open both arguments.',
  strengths: [strength],
  moments: [firstMoment, secondMoment],
  patterns: [pattern],
  asrDivergences: [
    {
      startSeconds: 11,
      endSeconds: 11.4,
      asrVersion: 'e',
      heardVersion: 'eee',
      relevance: 'The transcript hides an audible prolongation.',
    },
  ],
  priorities: [priority],
}

const createWith = (overrides: Partial<CreateCommunicationFeedbackParams>): CommunicationFeedback =>
  CommunicationFeedback.create({ ...validParams, ...overrides })

describe('CommunicationFeedback', () => {
  it('exposes the closed enumerations of the contract', () => {
    expect(AUDIO_USABILITIES).toEqual(['usable', 'limited', 'unusable'])
    expect(ALIGNMENT_QUALITIES).toEqual(['reliable', 'partial', 'unreliable'])
    expect(TIMING_BASES).toEqual(['asr', 'audio'])
    expect(MOMENT_VALENCES).toEqual(['positive', 'neutral', 'negative'])
    expect(FEEDBACK_CONFIDENCES).toEqual(['low', 'medium', 'high'])
    expect(MOMENT_CATEGORIES).toEqual([
      'filler',
      'prolongation',
      'repetition',
      'restart',
      'pause',
      'articulation',
      'delivery',
      'structure',
      'clarity',
    ])
  })

  it('keeps a valid payload intact through creation and reconstitution', () => {
    const feedback = CommunicationFeedback.create(validParams)

    expect(feedback).toMatchObject(validParams)
    expect(CommunicationFeedback.reconstitute(validParams)).toEqual(feedback)
  })

  it('rejects mutation of the persisted lists', () => {
    const feedback = CommunicationFeedback.create(validParams)

    expect(Object.isFrozen(feedback.moments)).toBe(true)
    expect(Object.isFrozen(feedback.moments[0])).toBe(true)
    expect(Object.isFrozen(feedback.limitations)).toBe(true)
  })

  it.each([
    ['limitations', { limitations: Array.from({ length: 6 }, (_, index) => `Limit ${index}.`) }],
    [
      'strengths',
      {
        strengths: Array.from({ length: 4 }, (_, index) => ({
          title: `Strength ${index}`,
          evidence: `Evidence ${index}.`,
          whyItHelped: `It helped ${index}.`,
        })),
      },
    ],
    [
      'moments',
      {
        moments: Array.from({ length: 9 }, (_, index) => ({
          ...firstMoment,
          id: `M${index + 1}`,
        })),
        patterns: [],
        priorities: [],
      },
    ],
    [
      'patterns',
      {
        patterns: Array.from({ length: 6 }, (_, index) => ({
          title: `Pattern ${index}`,
          description: `Description ${index}.`,
          evidenceMomentIds: ['M1', 'M2'],
          impact: `Impact ${index}.`,
          exercise: `Exercise ${index}.`,
        })),
      },
    ],
    [
      'asrDivergences',
      {
        asrDivergences: Array.from({ length: 6 }, (_, index) => ({
          startSeconds: index,
          endSeconds: index + 0.5,
          asrVersion: `e${index}`,
          heardVersion: `eee${index}`,
          relevance: `Relevance ${index}.`,
        })),
      },
    ],
    [
      'priorities',
      {
        priorities: Array.from({ length: 4 }, (_, index) => ({
          title: `Priority ${index}`,
          behavior: `Behavior ${index}.`,
          evidenceMomentIds: ['M1'],
          importance: `Importance ${index}.`,
          action: `Action ${index}.`,
          exercise: `Exercise ${index}.`,
        })),
      },
    ],
  ] as const)('rejects %s above the contract limit', (_field, overrides) => {
    expect(() => createWith(overrides)).toThrow(InvalidCommunicationFeedbackError)
  })

  it('accepts every list empty', () => {
    const feedback = createWith({
      limitations: [],
      strengths: [],
      moments: [],
      patterns: [],
      asrDivergences: [],
      priorities: [],
    })

    expect(feedback.moments).toEqual([])
  })

  it('rejects duplicated moment ids', () => {
    expect(() => createWith({ moments: [firstMoment, { ...secondMoment, id: 'M1' }] })).toThrow(
      InvalidCommunicationFeedbackError,
    )
  })

  it.each(['1', 'M0', 'm1', 'M1a', 'M 1'])('rejects the moment id %s', (id) => {
    expect(() =>
      createWith({
        moments: [{ ...firstMoment, id }],
        patterns: [],
        priorities: [],
      }),
    ).toThrow(InvalidCommunicationFeedbackError)
  })

  it('rejects an interval that ends before it starts', () => {
    expect(() =>
      createWith({
        moments: [{ ...firstMoment, startSeconds: 5, endSeconds: 4 }],
        patterns: [],
        priorities: [],
      }),
    ).toThrow(InvalidCommunicationFeedbackError)
  })

  it('rejects an interval beyond the audio duration tolerance', () => {
    expect(() =>
      createWith({
        moments: [{ ...firstMoment, startSeconds: 42, endSeconds: 42.8 }],
        patterns: [],
        priorities: [],
      }),
    ).toThrow(InvalidCommunicationFeedbackError)
  })

  it('accepts an interval inside the quarter second tolerance', () => {
    const feedback = createWith({
      moments: [{ ...firstMoment, startSeconds: 42, endSeconds: 42.75 }],
      patterns: [],
      priorities: [],
    })

    expect(feedback.moments[0]?.endSeconds).toBe(42.75)
  })

  it('rejects a negative interval', () => {
    expect(() =>
      createWith({
        moments: [{ ...firstMoment, startSeconds: -0.5 }],
        patterns: [],
        priorities: [],
      }),
    ).toThrow(InvalidCommunicationFeedbackError)
  })

  it('rejects an ASR divergence outside the audio duration', () => {
    expect(() =>
      createWith({
        asrDivergences: [
          {
            startSeconds: 60,
            endSeconds: 61,
            asrVersion: 'e',
            heardVersion: 'eee',
            relevance: 'Out of range.',
          },
        ],
      }),
    ).toThrow(InvalidCommunicationFeedbackError)
  })

  it('rejects a pattern citing an unknown moment', () => {
    expect(() =>
      createWith({
        patterns: [{ ...pattern, evidenceMomentIds: ['M1', 'M9'] }],
      }),
    ).toThrow(InvalidCommunicationFeedbackError)
  })

  it('rejects a priority citing an unknown moment', () => {
    expect(() =>
      createWith({
        priorities: [{ ...priority, evidenceMomentIds: ['M7'] }],
      }),
    ).toThrow(InvalidCommunicationFeedbackError)
  })

  it.each([[['M1']], [['M1', 'M1']], [[]]])(
    'rejects a pattern without two distinct evidences: %j',
    (evidenceMomentIds) => {
      expect(() => createWith({ patterns: [{ ...pattern, evidenceMomentIds }] })).toThrow(
        InvalidCommunicationFeedbackError,
      )
    },
  )

  it('accepts a moment without a clearer alternative', () => {
    const feedback = createWith({
      moments: [{ ...firstMoment, clearerAlternative: null }, secondMoment],
    })

    expect(feedback.moments[0]?.clearerAlternative).toBeNull()
  })

  it('rejects a blank clearer alternative instead of null', () => {
    expect(() =>
      createWith({
        moments: [{ ...firstMoment, clearerAlternative: '   ' }, secondMoment],
      }),
    ).toThrow(InvalidCommunicationFeedbackError)
  })

  it('rejects a moment without categories', () => {
    expect(() =>
      createWith({ moments: [{ ...firstMoment, categories: [] }, secondMoment] }),
    ).toThrow(InvalidCommunicationFeedbackError)
  })

  it('rejects duplicated categories in a moment', () => {
    expect(() =>
      createWith({
        moments: [{ ...firstMoment, categories: ['filler', 'filler'] }, secondMoment],
      }),
    ).toThrow(InvalidCommunicationFeedbackError)
  })

  it('rejects a technical category used as the user explanation', () => {
    expect(() =>
      createWith({ moments: [{ ...firstMoment, observation: 'filler' }, secondMoment] }),
    ).toThrow(InvalidCommunicationFeedbackError)
  })

  it.each([
    '<b>bold</b>',
    'see [the guide](https://example.com)',
    'visit https://example.com',
    'visit www.example.com',
    'run ```rm -rf```',
    '![image](data:image/png;base64,AAA)',
  ])('rejects markup or links in text: %s', (text) => {
    expect(() => createWith({ mainMessage: text })).toThrow(InvalidCommunicationFeedbackError)
  })

  it.each(['literalTranscript', 'mainMessage', 'attemptedStructure'] as const)(
    'rejects a blank %s',
    (field) => {
      expect(() => createWith({ [field]: '   ' })).toThrow(InvalidCommunicationFeedbackError)
    },
  )

  it('rejects an empty item inside a list', () => {
    expect(() => createWith({ limitations: [''] })).toThrow(InvalidCommunicationFeedbackError)
  })

  it('rejects duplicated items inside a list', () => {
    const limitation = 'Background noise hides the end of the last sentence.'

    expect(() => createWith({ limitations: [limitation, limitation] })).toThrow(
      InvalidCommunicationFeedbackError,
    )
  })

  it('rejects duplicated objects inside a list', () => {
    expect(() => createWith({ strengths: [strength, strength] })).toThrow(
      InvalidCommunicationFeedbackError,
    )
  })

  it.each(['One single sentence only.', 'One. Two. Three. Four. Five.', '   '])(
    'rejects a summary outside two to four sentences: %s',
    (summary) => {
      expect(() => createWith({ summary })).toThrow(InvalidCommunicationFeedbackError)
    },
  )

  it('accepts a summary of four sentences', () => {
    const summary = 'The message arrives. The order holds. Fillers appear twice. Try again.'

    expect(createWith({ summary }).summary).toBe(summary)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects the audio duration %s',
    (durationSeconds) => {
      expect(() => createWith({ durationSeconds })).toThrow(InvalidCommunicationFeedbackError)
    },
  )
})
