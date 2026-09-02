import { describe, expect, it } from 'vitest'

import type { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import type { AnalysisCostEntry } from '@/modules/analyses/domain/entities/analysis-cost-entry/index.js'
import type { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import { AudioPreparationFailedError } from '@/modules/analyses/domain/errors/audio-preparation-failed-error/index.js'
import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'
import { TranscriptionFailedError } from '@/modules/analyses/domain/errors/transcription-failed-error/index.js'
import type { PreparedAudio } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import type { AudioContent } from '@/modules/analyses/domain/ports/audio-reader-port/index.js'
import type { EvaluationResult } from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import type { TranscriptionResult } from '@/modules/analyses/domain/ports/transcription-port/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'

import { ProcessSessionAudioUseCase } from './index.js'
import type { ProcessSessionAudioDependencies } from './types.js'

const SESSION_ID = 'session-id'
const ACCOUNT_ID = 'account-id'
const THEME_ID = 'theme-id'
const NOW = new Date('2026-09-01T12:00:00.000Z')
const feedback = {
  summary: 'A clear message with a steady delivery.',
  strengths: [{ title: 'Opening', evidence: 'The main point appears immediately.' }],
  improvements: [
    { title: 'Closing', evidence: 'The ending trails off.', action: 'Repeat the main point.' },
  ],
}

class FakeAudioReader {
  read(): Promise<AudioContent> {
    return Promise.resolve({
      bytes: Buffer.from('original-audio'),
      contentType: 'audio/webm',
      durationSeconds: 30,
    })
  }
}

class FakeAudioPreparation {
  readonly received: AudioContent[] = []
  private failure: AudioPreparationFailedError | null = null

  prepare(input: { readonly source: AudioContent }): Promise<PreparedAudio> {
    this.received.push(input.source)
    if (this.failure !== null) return Promise.reject(this.failure)
    return Promise.resolve({
      bytes: Buffer.from('flac'),
      contentType: 'audio/flac',
      durationSeconds: 30,
    })
  }

  failNext(error: AudioPreparationFailedError): void {
    this.failure = error
  }
}

class FakeTranscription {
  readonly received: Buffer[] = []
  private failure: TranscriptionFailedError | null = null

  transcribe(input: { readonly audio: Buffer }): Promise<TranscriptionResult> {
    this.received.push(input.audio)
    if (this.failure !== null) return Promise.reject(this.failure)
    return Promise.resolve({
      text: 'My speech transcript.',
      words: [{ word: 'speech', start: 0, end: 1, confidence: 0.99 }],
      averageConfidence: 0.99,
      durationSeconds: 30,
    })
  }

  failNext(error: TranscriptionFailedError): void {
    this.failure = error
  }
}

class FakeEvaluation {
  readonly received: {
    readonly audio: PreparedAudio
    readonly themeTitle: string
    readonly transcript: string
    readonly words: TranscriptionResult['words']
  }[] = []
  private failure: EvaluationFailedError | null = null

  evaluate(input: {
    readonly audio: PreparedAudio
    readonly themeTitle: string
    readonly transcript: string
    readonly words: TranscriptionResult['words']
  }): Promise<EvaluationResult> {
    this.received.push(input)
    if (this.failure !== null) return Promise.reject(this.failure)
    return Promise.resolve({ feedback, inputTokens: 100, outputTokens: 50 })
  }

  failNext(error: EvaluationFailedError): void {
    this.failure = error
  }
}

function createFixture() {
  const analyses: Analysis[] = []
  const transcriptions: Transcription[] = []
  const costs: AnalysisCostEntry[] = []
  const audioReader = new FakeAudioReader()
  const audioPreparation = new FakeAudioPreparation()
  const transcription = new FakeTranscription()
  const evaluation = new FakeEvaluation()
  const eventBus = new FakeEventBus()
  const clock = new ControllableClock(NOW)
  let nextId = 0
  const dependencies: ProcessSessionAudioDependencies = {
    accounts: {
      findPlan: () => Promise.resolve('free'),
      resolveAccountId: () => Promise.resolve(ACCOUNT_ID),
    },
    analyses: {
      findBySessionId: () => Promise.resolve(analyses[0] ?? null),
      markFirstView: () => Promise.resolve(false),
      save: (analysis) => {
        analyses.push(analysis)
        return Promise.resolve()
      },
    },
    audioPreparation,
    audioReader,
    clock,
    costRates: {
      transcriptionCostPerMinuteMicros: 4_800,
      geminiInputCostPerMtokMicros: 300_000,
      geminiOutputCostPerMtokMicros: 2_500_000,
    },
    costs: {
      save: (entry) => {
        costs.push(entry)
        return Promise.resolve()
      },
      sumMicrosBetween: () => Promise.resolve(0),
    },
    evaluation,
    eventPublisher: eventBus,
    idGenerator: { generate: () => `id-${++nextId}` },
    logger: { warn: () => undefined },
    sessions: {
      findProcessingContext: () =>
        Promise.resolve({
          sessionId: SESSION_ID,
          accountId: ACCOUNT_ID,
          themeId: THEME_ID,
          audioPath: 'audio/path',
          recordedAt: NOW,
        }),
      listStuckProcessing: () => Promise.resolve([]),
      checkAnalysisAccess: () => Promise.resolve({ readable: false, failure: null }),
    },
    themes: { findTitle: () => Promise.resolve('Clear communication') },
    transcription,
    transcriptions: {
      findBySessionId: () => Promise.resolve(null),
      save: (value) => {
        transcriptions.push(value)
        return Promise.resolve()
      },
    },
    unitOfWork: { run: (operation) => operation() },
  }

  return {
    useCase: new ProcessSessionAudioUseCase(dependencies),
    analyses,
    transcriptions,
    costs,
    audioPreparation,
    transcription,
    evaluation,
    eventBus,
  }
}

describe('ProcessSessionAudioUseCase', () => {
  it('transcribes once and sends the prepared audio with the transcript to Gemini once', async () => {
    const fixture = createFixture()

    await fixture.useCase.execute({ sessionId: SESSION_ID })

    expect(fixture.transcription.received[0]).toEqual(Buffer.from('original-audio'))
    expect(fixture.audioPreparation.received).toHaveLength(1)
    expect(fixture.evaluation.received).toHaveLength(1)
    expect(fixture.evaluation.received[0]).toMatchObject({
      themeTitle: 'Clear communication',
      transcript: 'My speech transcript.',
      words: [{ word: 'speech', start: 0, end: 1, confidence: 0.99 }],
      audio: { contentType: 'audio/flac', bytes: Buffer.from('flac') },
    })
    expect(fixture.analyses[0]?.feedback).toEqual(feedback)
    expect(fixture.transcriptions).toHaveLength(1)
    expect(fixture.costs).toHaveLength(1)
    expect(fixture.eventBus.published).toHaveLength(1)
    expect(fixture.eventBus.published[0]).toMatchObject({
      eventName: 'analysis_completed',
      payload: { sessionId: SESSION_ID },
    })
    expect(fixture.eventBus.published[0]?.payload).not.toHaveProperty('scores')
  })

  it('is idempotent after an analysis exists', async () => {
    const fixture = createFixture()
    await fixture.useCase.execute({ sessionId: SESSION_ID })
    await fixture.useCase.execute({ sessionId: SESSION_ID })

    expect(fixture.evaluation.received).toHaveLength(1)
  })

  it.each([
    [
      'transcription',
      (fixture: ReturnType<typeof createFixture>) =>
        fixture.transcription.failNext(new TranscriptionFailedError('failed')),
      'transcription_failed',
    ],
    [
      'audio preparation',
      (fixture: ReturnType<typeof createFixture>) =>
        fixture.audioPreparation.failNext(new AudioPreparationFailedError('failed')),
      'audio_preparation_failed',
    ],
    [
      'Gemini',
      (fixture: ReturnType<typeof createFixture>) =>
        fixture.evaluation.failNext(new EvaluationFailedError('failed')),
      'evaluation_failed',
    ],
  ])('publishes one terminal failure when %s fails', async (_stage, fail, reason) => {
    const fixture = createFixture()
    fail(fixture)

    await expect(fixture.useCase.execute({ sessionId: SESSION_ID })).rejects.toBeDefined()

    expect(fixture.analyses).toHaveLength(0)
    expect(fixture.eventBus.published).toHaveLength(1)
    expect(fixture.eventBus.published[0]).toMatchObject({
      eventName: 'analysis_failed',
      payload: { reason },
    })
  })
})
