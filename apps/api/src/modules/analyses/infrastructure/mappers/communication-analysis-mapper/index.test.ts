import { describe, expect, it } from 'vitest'

import { CommunicationAnalysis } from '@/modules/analyses/domain/entities/communication-analysis/index.js'
import type { CommunicationAnalysisRow } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'

import { CommunicationAnalysisMapper } from './index.js'

const feedback = {
  durationSeconds: 42.5,
  audioUsability: 'usable',
  alignmentQuality: 'reliable',
  limitations: ['Background noise hides the end of the last sentence.'],
  literalTranscript: 'entao eee eu acho que o ponto principal e este',
  mainMessage: 'The speaker defends remote work with two arguments.',
  attemptedStructure: 'Opening, two arguments and a closing sentence.',
  summary: 'The message arrives complete and in order. Fillers open both arguments.',
  strengths: [
    {
      title: 'Clear closing',
      evidence: 'The last sentence repeats the thesis in five words.',
      whyItHelped: 'The listener leaves with the main idea.',
    },
  ],
  moments: [
    {
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
    },
    {
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
    },
  ],
  patterns: [
    {
      title: 'Filler before every argument',
      description: 'Both arguments open with a stretched filler.',
      evidenceMomentIds: ['M1', 'M2'],
      impact: 'The start of each idea sounds hesitant.',
      exercise: 'Read a paragraph aloud starting each sentence after a silent breath.',
    },
  ],
  asrDivergences: [
    {
      startSeconds: 11,
      endSeconds: 11.4,
      asrVersion: 'e',
      heardVersion: 'eee',
      relevance: 'The transcript hides an audible prolongation.',
    },
  ],
  priorities: [
    {
      title: 'Replace the opening filler',
      behavior: 'Starting an argument with a stretched vowel.',
      evidenceMomentIds: ['M1', 'M2'],
      importance: 'It is the most frequent pattern of this attempt.',
      action: 'Breathe before starting the sentence.',
      exercise: 'Record three openings without any filler.',
    },
  ],
}

const row: CommunicationAnalysisRow = {
  id: 'analysis-id',
  sessionId: 'session-id',
  feedbackVersion: 2,
  promptVersion: 'speech-feedback-v1',
  feedback,
  processingMs: 4321,
  costMicrosUsd: 3800,
  createdAt: new Date('2026-09-01T12:00:00.000Z'),
}

describe('CommunicationAnalysisMapper', () => {
  it('maps the persisted feedback to and from the domain without loss', () => {
    const mapper = new CommunicationAnalysisMapper()
    const analysis = mapper.toDomain(row)

    expect(analysis).toBeInstanceOf(CommunicationAnalysis)
    expect(mapper.toData(analysis)).toEqual(row)
  })

  it('rejects a persisted feedback carrying a score', () => {
    const mapper = new CommunicationAnalysisMapper()

    expect(() => mapper.toDomain({ ...row, feedback: { ...feedback, clarityScore: 80 } })).toThrow(
      expect.objectContaining({ code: 'shared.DATABASE_ERROR' }),
    )
  })

  it('rejects a persisted feedback carrying guidance', () => {
    const mapper = new CommunicationAnalysisMapper()

    expect(() =>
      mapper.toDomain({ ...row, feedback: { ...feedback, guidance: 'speak slower' } }),
    ).toThrow(expect.objectContaining({ code: 'shared.DATABASE_ERROR' }))
  })

  it.each([
    ['an unknown enumeration value', { ...feedback, audioUsability: 'perfect' }],
    ['a missing field', { ...feedback, summary: undefined }],
    ['a broken shape', 'not an object'],
  ])('rejects a persisted feedback with %s', (_reason, persisted) => {
    const mapper = new CommunicationAnalysisMapper()

    expect(() => mapper.toDomain({ ...row, feedback: persisted })).toThrow(
      expect.objectContaining({ code: 'shared.DATABASE_ERROR' }),
    )
  })

  it('rejects a persisted feedback that breaks a semantic invariant', () => {
    const mapper = new CommunicationAnalysisMapper()
    const broken = {
      ...feedback,
      patterns: [{ ...feedback.patterns[0], evidenceMomentIds: ['M1', 'M8'] }],
    }

    expect(() => mapper.toDomain({ ...row, feedback: broken })).toThrow(
      expect.objectContaining({ code: 'analyses.INVALID_COMMUNICATION_FEEDBACK' }),
    )
  })

  it('persists no score or guidance column', () => {
    const mapper = new CommunicationAnalysisMapper()

    expect(Object.keys(mapper.toData(mapper.toDomain(row)))).toEqual([
      'id',
      'sessionId',
      'feedbackVersion',
      'promptVersion',
      'feedback',
      'processingMs',
      'costMicrosUsd',
      'createdAt',
    ])
  })
})
