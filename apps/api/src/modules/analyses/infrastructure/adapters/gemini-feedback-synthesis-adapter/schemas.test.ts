import { describe, expect, it } from 'vitest'

import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import { CommunicationFeedback } from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'

import { parseCommunicationFeedback } from './schemas.js'

const DURATION_SECONDS = 42.5

const firstMoment = {
  id: 'M1',
  startSeconds: 3.2,
  endSeconds: 4.1,
  timingBasis: 'asr',
  excerpt: 'então eu acho que',
  observation: 'Uma hesitação longa antecede o ponto principal.',
  impact: 'A ideia soa menos firme do que é.',
  nextAttempt: 'Faça uma pausa em silêncio no lugar do preenchimento.',
  clearerAlternative: 'Então, o ponto principal é este.',
  categories: ['filler'],
  valence: 'negative',
  confidence: 'high',
}

const secondMoment = {
  id: 'M2',
  startSeconds: 11,
  endSeconds: 12.4,
  timingBasis: 'audio',
  excerpt: 'ééé o segundo ponto',
  observation: 'O mesmo preenchimento abre o segundo argumento.',
  impact: 'A abertura perde força.',
  nextAttempt: 'Comece a frase pelo substantivo.',
  clearerAlternative: null,
  categories: ['filler', 'prolongation'],
  valence: 'negative',
  confidence: 'medium',
}

const validFeedback = {
  audioUsability: 'usable',
  alignmentQuality: 'reliable',
  limitations: ['Ruído de fundo cobre o fim da última frase.'],
  literalTranscript: 'então ééé eu acho que o ponto principal é este',
  mainMessage: 'A pessoa defende o trabalho remoto com dois argumentos.',
  attemptedStructure: 'Abertura, dois argumentos e uma frase de fechamento.',
  summary: 'A mensagem chega inteira e na ordem. Preenchimentos abrem os dois argumentos.',
  strengths: [
    {
      title: 'Fechamento claro',
      evidence: 'A última frase repete a tese em cinco palavras.',
      whyItHelped: 'A pessoa que ouve sai com a ideia principal.',
    },
  ],
  moments: [firstMoment, secondMoment],
  patterns: [
    {
      title: 'Preenchimento antes de cada argumento',
      description: 'Os dois argumentos começam com um som prolongado.',
      evidenceMomentIds: ['M1', 'M2'],
      impact: 'O início de cada ideia soa hesitante.',
      exercise: 'Leia um parágrafo em voz alta começando cada frase após uma respiração.',
    },
  ],
  asrDivergences: [
    {
      startSeconds: 11,
      endSeconds: 11.4,
      asrVersion: 'é',
      heardVersion: 'ééé',
      relevance: 'O prolongamento sustenta o padrão observado.',
    },
  ],
  priorities: [
    {
      title: 'Trocar o preenchimento de abertura',
      behavior: 'Começar um argumento com uma vogal prolongada.',
      evidenceMomentIds: ['M1', 'M2'],
      importance: 'É o padrão mais frequente desta tentativa.',
      action: 'Respire antes de começar a frase.',
      exercise: 'Grave três aberturas sem nenhum preenchimento.',
    },
  ],
}

describe('parseCommunicationFeedback', () => {
  it('returns a communication feedback value object bound to the audio duration', () => {
    const feedback = parseCommunicationFeedback(validFeedback, DURATION_SECONDS)

    expect(feedback).toBeInstanceOf(CommunicationFeedback)
    expect(feedback.durationSeconds).toBe(DURATION_SECONDS)
    expect(feedback.moments.map((moment) => moment.id)).toEqual(['M1', 'M2'])
    expect(feedback.patterns[0]?.evidenceMomentIds).toEqual(['M1', 'M2'])
  })

  it.each([
    'audioUsability',
    'alignmentQuality',
    'limitations',
    'literalTranscript',
    'mainMessage',
    'attemptedStructure',
    'summary',
    'strengths',
    'moments',
    'patterns',
    'asrDivergences',
    'priorities',
  ] as const)('rejects a payload missing %s', (field) => {
    const payload = Object.fromEntries(
      Object.entries(validFeedback).filter(([key]) => key !== field),
    )

    expect(() => parseCommunicationFeedback(payload, DURATION_SECONDS)).toThrow(
      MalformedEvaluationError,
    )
  })

  it.each([
    ['a pillar score key', { ...validFeedback, clarityScore: 80 }],
    ['a guidance key', { ...validFeedback, masteryGuidance: 'Fale mais devagar.' }],
    ['a total score key', { ...validFeedback, totalScore: 90 }],
    ['an undeclared key', { ...validFeedback, extra: 'value' }],
    [
      'a score key inside a moment',
      { ...validFeedback, moments: [{ ...firstMoment, score: 10 }, secondMoment] },
    ],
    ['an unknown alignment quality', { ...validFeedback, alignmentQuality: 'perfect' }],
    [
      'an unknown moment category',
      {
        ...validFeedback,
        moments: [{ ...firstMoment, categories: ['emotion'] }, secondMoment],
      },
    ],
    [
      'a malformed moment id',
      {
        ...validFeedback,
        moments: [{ ...firstMoment, id: 'moment-1' }, secondMoment],
      },
    ],
    [
      'an evidence reference to an unknown moment',
      {
        ...validFeedback,
        priorities: [{ ...validFeedback.priorities[0], evidenceMomentIds: ['M9'] }],
      },
    ],
    [
      'a pattern sustained by a single moment',
      {
        ...validFeedback,
        patterns: [{ ...validFeedback.patterns[0], evidenceMomentIds: ['M1'] }],
      },
    ],
    [
      'a moment ending after the audio duration',
      {
        ...validFeedback,
        moments: [{ ...firstMoment, startSeconds: 60, endSeconds: 61 }, secondMoment],
      },
    ],
    [
      'an inverted moment interval',
      {
        ...validFeedback,
        moments: [{ ...firstMoment, startSeconds: 5, endSeconds: 4 }, secondMoment],
      },
    ],
    [
      'markup in the summary',
      {
        ...validFeedback,
        summary: '<b>A mensagem chega inteira.</b> Os argumentos abrem com preenchimento.',
      },
    ],
    ['an empty main message', { ...validFeedback, mainMessage: '   ' }],
    [
      'more than three priorities',
      {
        ...validFeedback,
        priorities: ['Primeira', 'Segunda', 'Terceira', 'Quarta'].map((title) => ({
          ...validFeedback.priorities[0],
          title,
        })),
      },
    ],
    ['a duplicated moment id', { ...validFeedback, moments: [firstMoment, firstMoment] }],
  ])('rejects %s', (_description, payload) => {
    expect(() => parseCommunicationFeedback(payload, DURATION_SECONDS)).toThrow(
      MalformedEvaluationError,
    )
  })

  it('accepts an empty section without inventing placeholders', () => {
    const feedback = parseCommunicationFeedback(
      { ...validFeedback, strengths: [], patterns: [], asrDivergences: [], limitations: [] },
      DURATION_SECONDS,
    )

    expect(feedback.strengths).toEqual([])
    expect(feedback.patterns).toEqual([])
    expect(feedback.asrDivergences).toEqual([])
    expect(feedback.limitations).toEqual([])
  })
})
