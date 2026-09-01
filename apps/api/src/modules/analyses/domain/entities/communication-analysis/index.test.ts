import { describe, expect, it } from 'vitest'

import { InvalidCommunicationAnalysisError } from '@/modules/analyses/domain/errors/invalid-communication-analysis-error/index.js'
import { CommunicationFeedback } from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'

import { COMMUNICATION_FEEDBACK_VERSION, CommunicationAnalysis } from './index.js'

const feedback = CommunicationFeedback.create({
  durationSeconds: 30,
  audioUsability: 'usable',
  alignmentQuality: 'reliable',
  limitations: [],
  literalTranscript: 'entao eee eu acho que o ponto principal e este',
  mainMessage: 'The speaker defends remote work.',
  attemptedStructure: 'Opening, argument and closing.',
  summary: 'The message arrives complete. A filler opens the argument.',
  strengths: [],
  moments: [],
  patterns: [],
  asrDivergences: [],
  priorities: [],
})

const validParams = {
  analysisId: 'analysis-id',
  sessionId: 'session-id',
  promptVersion: 'speech-feedback-v1',
  feedback,
  processingMs: 4321,
  costMicrosUsd: 3800,
  createdAt: new Date('2026-09-01T12:00:00.000Z'),
}

describe('CommunicationAnalysis', () => {
  it('always carries the second feedback version', () => {
    const analysis = CommunicationAnalysis.create(validParams)

    expect(COMMUNICATION_FEEDBACK_VERSION).toBe(2)
    expect(analysis.feedbackVersion).toBe(2)
    expect(analysis).toMatchObject({
      id: 'analysis-id',
      sessionId: 'session-id',
      promptVersion: 'speech-feedback-v1',
      feedback,
      processingMs: 4321,
      costMicrosUsd: 3800,
    })
    expect(analysis.createdAt).toEqual(validParams.createdAt)
  })

  it('exposes no score or guidance', () => {
    const analysis = CommunicationAnalysis.create(validParams)

    expect(Object.keys(analysis)).not.toContain('totalScore')
    expect(Object.keys(analysis)).not.toContain('guidance')
  })

  it('requires a prompt version', () => {
    expect(() => CommunicationAnalysis.create({ ...validParams, promptVersion: '  ' })).toThrow(
      InvalidCommunicationAnalysisError,
    )
  })

  it.each([-1, 1.5, Number.NaN])('rejects the processing time %s', (processingMs) => {
    expect(() => CommunicationAnalysis.create({ ...validParams, processingMs })).toThrow(
      InvalidCommunicationAnalysisError,
    )
  })

  it.each([-1, 1.5, Number.NaN])('rejects the cost %s', (costMicrosUsd) => {
    expect(() => CommunicationAnalysis.create({ ...validParams, costMicrosUsd })).toThrow(
      InvalidCommunicationAnalysisError,
    )
  })

  it('reconstitutes a persisted second version analysis', () => {
    const analysis = CommunicationAnalysis.reconstitute({ ...validParams, feedbackVersion: 2 })

    expect(analysis).toEqual(CommunicationAnalysis.create(validParams))
  })

  it.each([1, 3])('rejects a persisted analysis of version %s', (feedbackVersion) => {
    expect(() => CommunicationAnalysis.reconstitute({ ...validParams, feedbackVersion })).toThrow(
      InvalidCommunicationAnalysisError,
    )
  })
})
