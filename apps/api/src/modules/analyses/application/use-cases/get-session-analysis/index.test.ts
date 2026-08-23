import { describe, expect, it } from 'vitest'

import { AnalysisAuthenticationRejectedError } from '@/modules/analyses/domain/errors/analysis-authentication-rejected-error/index.js'
import { AnalysisNotFoundError } from '@/modules/analyses/domain/errors/analysis-not-found-error/index.js'
import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'
import { PillarScore } from '@/modules/analyses/domain/value-objects/pillar-score/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'

import { GetSessionAnalysisUseCase } from './index.js'

const NOW = new Date('2026-08-22T15:30:00.000Z')

describe('GetSessionAnalysisUseCase', () => {
  it('returns the readable analysis without sensitive processing data', async () => {
    const harness = createHarness()
    const useCase = new GetSessionAnalysisUseCase(harness.dependencies)

    const output = await useCase.execute({ sessionId: 'session-id', accountId: 'account-id' })

    expect(output).toEqual({
      sessionId: 'session-id',
      scores: { clarity: 70, rhythm: 90, fluency: 60, mastery: 85, total: 76 },
      guidance: [
        { pillar: 'clarity', text: 'Improve clarity.' },
        { pillar: 'fluency', text: 'Improve fluency.' },
      ],
      transcript: 'The exact transcript.',
      analyzedAt: NOW.toISOString(),
    })
    expect(output).not.toHaveProperty('words')
    expect(output).not.toHaveProperty('averageConfidence')
    expect(output).not.toHaveProperty('costMicrosUsd')
    expect(output).not.toHaveProperty('processingMs')
    expect(output).not.toHaveProperty('rhythmMetrics')
  })

  it('does not query analyses when the session is not readable', async () => {
    const harness = createHarness({ readable: false })
    const useCase = new GetSessionAnalysisUseCase(harness.dependencies)

    await expect(
      useCase.execute({ sessionId: 'session-id', accountId: 'account-id' }),
    ).rejects.toBeInstanceOf(AnalysisNotFoundError)
    expect(harness.analysisQueries).toBe(0)
  })

  it('rejects readable sessions without an analysis or transcription', async () => {
    const noAnalysis = createHarness({ analysis: null })
    const useCaseWithoutAnalysis = new GetSessionAnalysisUseCase(noAnalysis.dependencies)

    await expect(
      useCaseWithoutAnalysis.execute({ sessionId: 'session-id', accountId: 'account-id' }),
    ).rejects.toBeInstanceOf(AnalysisNotFoundError)

    const noTranscription = createHarness({ transcription: null })
    const useCaseWithoutTranscription = new GetSessionAnalysisUseCase(noTranscription.dependencies)

    await expect(
      useCaseWithoutTranscription.execute({ sessionId: 'session-id', accountId: 'account-id' }),
    ).rejects.toMatchObject({ context: { reason: 'transcription_missing' } })
  })

  it('publishes analysis_viewed only for the first view', async () => {
    const harness = createHarness({ firstView: true })
    const useCase = new GetSessionAnalysisUseCase(harness.dependencies)

    await useCase.execute({ sessionId: 'session-id', accountId: 'account-id' })
    await useCase.execute({ sessionId: 'session-id', accountId: 'account-id' })

    expect(harness.eventBus.published).toHaveLength(1)
    expect(harness.eventBus.published[0]).toMatchObject({
      eventName: 'analysis_viewed',
      eventId: 'event-id',
      occurredAt: NOW,
      payload: {
        sessionId: 'session-id',
        accountId: 'account-id',
        plan: 'free',
        scores: { clarity: 70, rhythm: 90, fluency: 60, mastery: 85, total: 76 },
      },
    })
  })

  it('rejects an unresolved plan before marking the first view', async () => {
    const harness = createHarness({ plan: null, firstView: true })
    const useCase = new GetSessionAnalysisUseCase(harness.dependencies)

    await expect(
      useCase.execute({ sessionId: 'session-id', accountId: 'account-id' }),
    ).rejects.toBeInstanceOf(AnalysisAuthenticationRejectedError)
    expect(harness.markFirstViewCalls).toBe(0)
    expect(harness.eventBus.published).toEqual([])
  })
})

function createHarness(
  input: {
    readonly analysis?: Analysis | null
    readonly firstView?: boolean
    readonly plan?: 'free' | null
    readonly readable?: boolean
    readonly transcription?: Transcription | null
  } = {},
) {
  let analysisQueries = 0
  let markFirstViewCalls = 0
  const eventBus = new FakeEventBus()
  const analysis = input.analysis === undefined ? createAnalysis() : input.analysis
  const transcription =
    input.transcription === undefined ? createTranscription() : input.transcription

  return {
    dependencies: {
      analyses: {
        findBySessionId: () => {
          analysisQueries += 1
          return Promise.resolve(analysis)
        },
        markFirstView: () => {
          markFirstViewCalls += 1
          return Promise.resolve((input.firstView ?? false) && markFirstViewCalls === 1)
        },
      },
      transcriptions: { findBySessionId: () => Promise.resolve(transcription) },
      sessions: { isReadableByAccount: () => Promise.resolve(input.readable ?? true) },
      accounts: { findPlan: () => Promise.resolve(input.plan === undefined ? 'free' : input.plan) },
      clock: new ControllableClock(NOW),
      idGenerator: { generate: () => 'event-id' },
      eventPublisher: eventBus,
    },
    get analysisQueries() {
      return analysisQueries
    },
    get markFirstViewCalls() {
      return markFirstViewCalls
    },
    eventBus,
  }
}

function createAnalysis(): Analysis {
  return Analysis.reconstitute({
    analysisId: 'analysis-id',
    sessionId: 'session-id',
    clarityScore: PillarScore.create(70),
    rhythmScore: PillarScore.create(90),
    fluencyScore: PillarScore.create(60),
    masteryScore: PillarScore.create(85),
    clarityGuidance: 'Improve clarity.',
    rhythmGuidance: 'Keep the rhythm.',
    fluencyGuidance: 'Improve fluency.',
    masteryGuidance: 'Keep mastering.',
    rhythmMetrics: RhythmMetrics.create({
      wordsPerMinute: 100,
      wordCount: 10,
      speechDurationSeconds: 6,
      pauseCount: 1,
      longPauseCount: 0,
      longestPauseSeconds: 1,
    }),
    processingMs: 1_000,
    costMicrosUsd: 10_000,
    createdAt: NOW,
  })
}

function createTranscription(): Transcription {
  return Transcription.reconstitute({
    transcriptionId: 'transcription-id',
    sessionId: 'session-id',
    text: 'The exact transcript.',
    words: [{ word: 'The', start: 0, end: 0.2, confidence: 0.99 }],
    averageConfidence: 0.99,
    durationSeconds: 0.2,
    createdAt: NOW,
  })
}
