import { describe, expect, it } from 'vitest'

import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import { AnalysisNotFoundError } from '@/modules/analyses/domain/errors/analysis-not-found-error/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'

import { GetSessionAnalysisUseCase } from './index.js'

const feedback = {
  summary: 'Clear and direct.',
  strengths: [{ title: 'Opening', evidence: 'Direct start.' }],
  improvements: [{ title: 'Close', evidence: 'Soft ending.', action: 'End firmly.' }],
}

function createUseCase(readable = true) {
  const eventBus = new FakeEventBus()
  const analysis = Analysis.create({
    analysisId: 'analysis-id',
    sessionId: 'session-id',
    feedback,
    processingMs: 100,
    costMicrosUsd: 10,
    createdAt: new Date('2026-09-01T12:00:00.000Z'),
  })
  const transcription = Transcription.create({
    transcriptionId: 'transcription-id',
    sessionId: 'session-id',
    text: 'Literal transcript.',
    words: [{ word: 'Literal', start: 0, end: 1, confidence: 1 }],
    durationSeconds: 1,
    createdAt: new Date('2026-09-01T12:00:00.000Z'),
  })
  return {
    eventBus,
    useCase: new GetSessionAnalysisUseCase({
      accounts: { findPlan: () => Promise.resolve('free') },
      analyses: {
        findBySessionId: () => Promise.resolve(analysis),
        markFirstView: () => Promise.resolve(true),
      },
      transcriptions: { findBySessionId: () => Promise.resolve(transcription) },
      sessions: {
        checkAnalysisAccess: () => Promise.resolve({ readable, failure: null }),
      },
      clock: new ControllableClock(new Date('2026-09-01T12:01:00.000Z')),
      idGenerator: { generate: () => 'event-id' },
      eventPublisher: eventBus,
    }),
  }
}

describe('GetSessionAnalysisUseCase', () => {
  it('returns feedback and transcript without scores or versions', async () => {
    const { useCase, eventBus } = createUseCase()

    const result = await useCase.execute({ sessionId: 'session-id', accountId: 'account-id' })

    expect(result).toEqual({
      sessionId: 'session-id',
      feedback,
      transcript: 'Literal transcript.',
      analyzedAt: '2026-09-01T12:00:00.000Z',
    })
    expect(result).not.toHaveProperty('scores')
    expect(eventBus.published[0]?.payload).toEqual({
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
    })
  })

  it('hides an analysis from another account', async () => {
    const { useCase } = createUseCase(false)

    await expect(
      useCase.execute({ sessionId: 'session-id', accountId: 'other-account' }),
    ).rejects.toBeInstanceOf(AnalysisNotFoundError)
  })
})
