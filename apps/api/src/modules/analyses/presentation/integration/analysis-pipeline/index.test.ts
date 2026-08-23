import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import { TranscriptionFailedError } from '@/modules/analyses/domain/errors/transcription-failed-error/index.js'
import {
  ANALYSES_TEST_NOW,
  createAnalysesIntegrationContainer,
  type AnalysesIntegrationContainer,
} from '@/modules/analyses/composition/integration-container.js'
import { clearAnalysesData } from '@/modules/analyses/composition/integration-fixtures.js'

let harness: AnalysesIntegrationContainer
const SESSION_ID = '00000000-0000-0000-0000-000000000001'
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000002'
const THEME_ID = '00000000-0000-0000-0000-000000000003'

beforeAll(async () => {
  harness = await createAnalysesIntegrationContainer({ databaseUrl: inject('databaseUrl') })
})

afterAll(async () => {
  await harness.close()
})

beforeEach(async () => {
  await clearAnalysesData(harness.prisma)
  harness.reset()
  harness.accounts.setPlan(ACCOUNT_ID, 'free')
  harness.sessions.setContext({
    sessionId: SESSION_ID,
    accountId: ACCOUNT_ID,
    themeId: THEME_ID,
    audioPath: 'audio/session',
    recordedAt: ANALYSES_TEST_NOW,
  })
  harness.themes.setTitle(THEME_ID, 'Mindfulness')
  harness.audioReader.setAudio(SESSION_ID, Buffer.from('audio'))
  harness.transcription.setResult({
    text: 'Transcript',
    words: [{ word: 'Transcript', start: 0, end: 1, confidence: 1 }],
    averageConfidence: 1,
    durationSeconds: 1,
  })
})

describe('analysis pipeline integration', () => {
  it('persists the successful pipeline and publishes its completion', async () => {
    await harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID })

    await expect(harness.prisma.transcription.count()).resolves.toBe(1)
    await expect(harness.prisma.analysis.count()).resolves.toBe(1)
    await expect(harness.prisma.analysisCostEntry.count()).resolves.toBe(1)
    expect(harness.eventBus.published).toHaveLength(1)
    expect(harness.eventBus.published[0]).toMatchObject({
      eventName: 'analysis_completed',
      payload: { accountId: ACCOUNT_ID, plan: 'free', scores: { total: 60 } },
    })
  })

  it('publishes a transcription failure without persistence', async () => {
    harness.transcription.failNext(new TranscriptionFailedError('provider unavailable'))

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID }),
    ).rejects.toMatchObject({ code: 'analyses.TRANSCRIPTION_FAILED' })

    await expect(harness.prisma.transcription.count()).resolves.toBe(0)
    await expect(harness.prisma.analysis.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'transcription_failed' } },
    ])
  })

  it('rejects a transcription without words', async () => {
    harness.transcription.setResult({
      text: '',
      words: [],
      averageConfidence: 0,
      durationSeconds: 1,
    })

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID }),
    ).rejects.toMatchObject({ code: 'analyses.TRANSCRIPTION_FAILED' })

    await expect(harness.prisma.transcription.count()).resolves.toBe(0)
    await expect(harness.prisma.analysis.count()).resolves.toBe(0)
  })

  it('publishes a malformed evaluation failure without persistence', async () => {
    harness.evaluation.respondWith({})

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID }),
    ).rejects.toBeInstanceOf(MalformedEvaluationError)

    await expect(harness.prisma.transcription.count()).resolves.toBe(0)
    await expect(harness.prisma.analysis.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'malformed_evaluation' } },
    ])
  })

  it('publishes a timeout without persistence', async () => {
    harness.clock.set(new Date(ANALYSES_TEST_NOW.getTime() + 300_001))

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID }),
    ).rejects.toMatchObject({ code: 'analyses.ANALYSIS_DEADLINE_EXCEEDED' })

    await expect(harness.prisma.transcription.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toMatchObject([{ eventName: 'analysis_timeout' }])
  })

  it('does not duplicate persistence or events when reprocessed', async () => {
    await harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID })
    await harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID })

    await expect(harness.prisma.analysis.count()).resolves.toBe(1)
    await expect(harness.prisma.transcription.count()).resolves.toBe(1)
    expect(harness.eventBus.published).toHaveLength(1)
  })

  it('rolls back the transcription and the analysis when the cost entry cannot be written', async () => {
    await harness.prisma.analysisCostEntry.create({
      data: {
        id: '00000000-0000-0000-0000-0000000000ff',
        sessionId: SESSION_ID,
        accountId: ACCOUNT_ID,
        transcriptionMicrosUsd: 1,
        evaluationMicrosUsd: 1,
        totalMicrosUsd: 2,
        incurredAt: ANALYSES_TEST_NOW,
      },
    })

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID }),
    ).rejects.toMatchObject({ code: 'shared.DATABASE_ERROR' })

    await expect(harness.prisma.transcription.count()).resolves.toBe(0)
    await expect(harness.prisma.analysis.count()).resolves.toBe(0)
    await expect(harness.prisma.analysisCostEntry.count()).resolves.toBe(1)
  })
})
