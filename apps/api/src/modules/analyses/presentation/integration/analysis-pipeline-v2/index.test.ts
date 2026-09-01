import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  ANALYSES_TEST_NOW,
  createAnalysesIntegrationContainer,
  type AnalysesIntegrationContainer,
} from '@/modules/analyses/composition/integration-container.js'
import { clearAnalysesData } from '@/modules/analyses/composition/integration-fixtures.js'
import { AudioPreparationFailedError } from '@/modules/analyses/domain/errors/audio-preparation-failed-error/index.js'
import { AuditoryAnalysisFailedError } from '@/modules/analyses/domain/errors/auditory-analysis-failed-error/index.js'
import { FeedbackSynthesisFailedError } from '@/modules/analyses/domain/errors/feedback-synthesis-failed-error/index.js'
import { TranscriptionFailedError } from '@/modules/analyses/domain/errors/transcription-failed-error/index.js'

let harness: AnalysesIntegrationContainer
const SESSION_ID = '00000000-0000-0000-0000-000000000001'
const OTHER_SESSION_ID = '00000000-0000-0000-0000-000000000004'
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000002'
const THEME_ID = '00000000-0000-0000-0000-000000000003'
const PRIVATE_TRANSCRIPT = 'Eu defendo o trabalho remoto com dados concretos'
const PRIVATE_MAIN_MESSAGE = 'A pessoa defende o trabalho remoto.'

beforeAll(async () => {
  harness = await createAnalysesIntegrationContainer({
    databaseUrl: inject('databaseUrl'),
    pipelineVersion: 'v2',
  })
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
    text: PRIVATE_TRANSCRIPT,
    words: [
      { word: 'Eu', start: 0, end: 0.2, confidence: 0.9 },
      { word: 'defendo', start: 0.4, end: 0.9, confidence: 0.9 },
      { word: 'remoto', start: 1.1, end: 1.6, confidence: 0.9 },
    ],
    averageConfidence: 0.9,
    durationSeconds: 3,
  })
})

describe('multimodal analysis pipeline integration', () => {
  it('persists the multimodal feedback and publishes a completion without scores', async () => {
    await harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID })

    await expect(harness.prisma.transcription.count()).resolves.toBe(1)
    await expect(harness.prisma.communicationAnalysis.count()).resolves.toBe(1)
    await expect(harness.prisma.analysis.count()).resolves.toBe(0)

    const stored = await harness.repositories.communicationAnalyses.findBySessionId(SESSION_ID)
    expect(stored).toMatchObject({
      sessionId: SESSION_ID,
      feedbackVersion: 2,
      promptVersion: 'speech-feedback-v1',
    })
    expect(stored?.feedback.audioUsability).toBe('usable')

    const costEntry = await harness.prisma.analysisCostEntry.findUniqueOrThrow({
      where: { sessionId: SESSION_ID },
    })
    expect(costEntry.evaluationMicrosUsd).toBe(
      costEntry.auditoryMicrosUsd + costEntry.synthesisMicrosUsd,
    )
    expect(costEntry.totalMicrosUsd).toBe(
      costEntry.transcriptionMicrosUsd + costEntry.evaluationMicrosUsd,
    )

    expect(harness.eventBus.published).toHaveLength(1)
    expect(harness.eventBus.published[0]).toMatchObject({
      eventName: 'analysis_completed',
      payload: { sessionId: SESSION_ID, accountId: ACCOUNT_ID, plan: 'free', analysisVersion: 2 },
    })
    expect(Object.keys(harness.eventBus.published[0]?.payload ?? {})).not.toContain('scores')
  })

  it('sends the canonical audio to both Gemini passes and the original to Deepgram', async () => {
    await harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID })

    expect(harness.audioPreparation.received).toHaveLength(1)
    expect(harness.auditoryAnalysis.received[0]?.audio.contentType).toBe('audio/flac')
    expect(harness.feedbackSynthesis.received[0]?.audio.contentType).toBe('audio/flac')
    expect(harness.feedbackSynthesis.received[0]).toMatchObject({
      themeTitle: 'Mindfulness',
      transcript: PRIVATE_TRANSCRIPT,
    })
  })

  it('does not duplicate persistence or events when reprocessed', async () => {
    await harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID })
    await harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID })

    await expect(harness.prisma.communicationAnalysis.count()).resolves.toBe(1)
    await expect(harness.prisma.transcription.count()).resolves.toBe(1)
    expect(harness.eventBus.published).toHaveLength(1)
  })

  it('skips a session whose account is unknown', async () => {
    harness.sessions.setContext({
      sessionId: OTHER_SESSION_ID,
      accountId: '00000000-0000-0000-0000-0000000000aa',
      themeId: THEME_ID,
      audioPath: 'audio/other',
      recordedAt: ANALYSES_TEST_NOW,
    })

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: OTHER_SESSION_ID }),
    ).resolves.toBeUndefined()

    await expect(harness.prisma.communicationAnalysis.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toHaveLength(0)
  })

  it('leaves no communication analysis when the audio preparation fails', async () => {
    harness.audioPreparation.failNext(new AudioPreparationFailedError('ffmpeg exited'))

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID }),
    ).rejects.toMatchObject({ code: 'analyses.AUDIO_PREPARATION_FAILED' })

    await expect(harness.prisma.communicationAnalysis.count()).resolves.toBe(0)
    await expect(harness.prisma.transcription.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'audio_preparation_failed' } },
    ])
  })

  it('leaves no communication analysis when the auditory analysis fails', async () => {
    harness.auditoryAnalysis.failNext(new AuditoryAnalysisFailedError('provider unavailable'))

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID }),
    ).rejects.toMatchObject({ code: 'analyses.AUDITORY_ANALYSIS_FAILED' })

    await expect(harness.prisma.communicationAnalysis.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'auditory_analysis_failed' } },
    ])
  })

  it('leaves no communication analysis when the transcription fails', async () => {
    harness.transcription.failNext(new TranscriptionFailedError('provider unavailable'))

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID }),
    ).rejects.toMatchObject({ code: 'analyses.TRANSCRIPTION_FAILED' })

    await expect(harness.prisma.communicationAnalysis.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'transcription_failed' } },
    ])
  })

  it('leaves no communication analysis when the synthesis fails', async () => {
    harness.feedbackSynthesis.failNext(new FeedbackSynthesisFailedError('provider unavailable'))

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID }),
    ).rejects.toMatchObject({ code: 'analyses.FEEDBACK_SYNTHESIS_FAILED' })

    await expect(harness.prisma.communicationAnalysis.count()).resolves.toBe(0)
    await expect(harness.prisma.transcription.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'feedback_synthesis_failed' } },
    ])
  })

  it('rejects a malformed synthesis response without persisting anything', async () => {
    harness.feedbackSynthesis.respondWith({})

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID }),
    ).rejects.toMatchObject({ code: 'analyses.MALFORMED_EVALUATION' })

    await expect(harness.prisma.communicationAnalysis.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'malformed_evaluation' } },
    ])
  })

  it('publishes a timeout without persistence once the deadline has passed', async () => {
    harness.clock.set(new Date(ANALYSES_TEST_NOW.getTime() + 300_001))

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID }),
    ).rejects.toMatchObject({ code: 'analyses.ANALYSIS_DEADLINE_EXCEEDED' })

    await expect(harness.prisma.communicationAnalysis.count()).resolves.toBe(0)
    expect(harness.eventBus.published).toMatchObject([{ eventName: 'analysis_timeout' }])
  })

  it('rolls back the whole write when the cost entry cannot be written', async () => {
    await harness.prisma.analysisCostEntry.create({
      data: {
        id: '00000000-0000-0000-0000-0000000000ff',
        sessionId: SESSION_ID,
        accountId: ACCOUNT_ID,
        transcriptionMicrosUsd: 1,
        evaluationMicrosUsd: 1,
        auditoryMicrosUsd: 1,
        synthesisMicrosUsd: 0,
        totalMicrosUsd: 2,
        incurredAt: ANALYSES_TEST_NOW,
      },
    })

    await expect(
      harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID }),
    ).rejects.toMatchObject({ code: 'shared.DATABASE_ERROR' })

    await expect(harness.prisma.transcription.count()).resolves.toBe(0)
    await expect(harness.prisma.communicationAnalysis.count()).resolves.toBe(0)
    await expect(harness.prisma.analysisCostEntry.count()).resolves.toBe(1)
  })

  it('never logs the audio, the transcript or the feedback', async () => {
    await harness.container.useCases.processSessionAudio.execute({ sessionId: SESSION_ID })

    const logs = harness.logs.join('\n')
    expect(logs).not.toContain(PRIVATE_TRANSCRIPT)
    expect(logs).not.toContain(PRIVATE_MAIN_MESSAGE)
    expect(logs).not.toContain('literalTranscript')
    expect(logs).not.toContain('candidateEvents')
  })
})
