import type { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import type { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { AnalysisLogger } from '@/modules/analyses/domain/ports/analysis-logger/index.js'
import type { EvaluationResult } from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import type { SessionProcessingContext } from '@/modules/analyses/domain/ports/sessions-port/index.js'
import type { TranscriptionResult } from '@/modules/analyses/domain/ports/transcription-port/index.js'
import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'
import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import { TranscriptionFailedError } from '@/modules/analyses/domain/errors/transcription-failed-error/index.js'
import { AnalysisDeadlineExceededError } from '@/modules/analyses/domain/errors/analysis-deadline-exceeded-error/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProcessSessionAudioUseCase } from './index.js'
import type { ProcessSessionAudioDependencies } from './types.js'

class InMemoryAnalysesRepository {
  readonly saved: Analysis[] = []

  findBySessionId(sessionId: string): Promise<Analysis | null> {
    return Promise.resolve(this.saved.find((analysis) => analysis.sessionId === sessionId) ?? null)
  }

  save(analysis: Analysis): Promise<void> {
    this.saved.push(analysis)
    return Promise.resolve()
  }
}

class InMemoryTranscriptionsRepository {
  readonly saved: Transcription[] = []

  findBySessionId(): Promise<Transcription | null> {
    return Promise.resolve(null)
  }

  save(transcription: Transcription): Promise<void> {
    this.saved.push(transcription)
    return Promise.resolve()
  }
}

class InMemoryCostEntriesRepository {
  readonly saved: { readonly sessionId: string; readonly totalMicrosUsd: number }[] = []

  save(entry: { readonly sessionId: string; readonly totalMicrosUsd: number }): Promise<void> {
    this.saved.push(entry)
    return Promise.resolve()
  }

  sumMicrosBetween(): Promise<number> {
    return Promise.resolve(0)
  }
}

class InMemorySessionsPort {
  constructor(private readonly context: SessionProcessingContext | null) {}

  findProcessingContext(): Promise<SessionProcessingContext | null> {
    return Promise.resolve(this.context)
  }
}

class InMemoryAudioReader {
  read(): Promise<Buffer> {
    return Promise.resolve(Buffer.from('audio'))
  }
}

class InMemoryTranscriptionPort {
  private failure: Error | null = null
  private hangs = false
  readonly received: { readonly audio: Buffer; readonly deadlineMs: number }[] = []

  constructor(private readonly result: TranscriptionResult) {}

  failNext(error: Error): void {
    this.failure = error
  }

  hangUntilAborted(): void {
    this.hangs = true
  }

  transcribe(input: {
    readonly audio: Buffer
    readonly deadlineMs: number
    readonly signal: AbortSignal
  }): Promise<TranscriptionResult> {
    this.received.push({ audio: input.audio, deadlineMs: input.deadlineMs })

    if (this.failure !== null) {
      const failure = this.failure
      this.failure = null
      return Promise.reject(failure)
    }

    if (!this.hangs) return Promise.resolve(this.result)
    this.hangs = false

    return new Promise<TranscriptionResult>((_resolve, reject) => {
      input.signal.addEventListener(
        'abort',
        () => reject(new TranscriptionFailedError('request aborted')),
        { once: true },
      )
    })
  }
}

class InMemoryThemesPort {
  constructor(private readonly title: string | null = 'Speaking with confidence') {}

  findTitle(): Promise<string | null> {
    return Promise.resolve(this.title)
  }
}

class InMemoryEvaluationPort {
  private failure: Error | null = null
  private hangs = false
  readonly received: {
    readonly themeTitle: string
    readonly transcript: string
    readonly rhythm: { readonly wordsPerMinute: number }
  }[] = []

  constructor(
    private readonly result: EvaluationResult,
    private readonly clock: ControllableClock,
  ) {}

  failNext(error: Error): void {
    this.failure = error
  }

  hangUntilAborted(): void {
    this.hangs = true
  }

  evaluate(input: {
    readonly themeTitle: string
    readonly transcript: string
    readonly rhythm: { readonly wordsPerMinute: number }
    readonly signal: AbortSignal
  }): Promise<EvaluationResult> {
    this.received.push({
      themeTitle: input.themeTitle,
      transcript: input.transcript,
      rhythm: input.rhythm,
    })

    if (this.failure !== null) {
      const failure = this.failure
      this.failure = null
      return Promise.reject(failure)
    }

    if (!this.hangs) {
      this.clock.advance(1_500)
      return Promise.resolve(this.result)
    }
    this.hangs = false

    return new Promise<EvaluationResult>((_resolve, reject) => {
      input.signal.addEventListener(
        'abort',
        () => reject(new EvaluationFailedError('request aborted')),
        { once: true },
      )
    })
  }
}

class InMemoryAccountsPort {
  constructor(private readonly plan: AccountPlan | null = 'free') {}

  findPlan(): Promise<AccountPlan | null> {
    return Promise.resolve(this.plan)
  }
}

class InMemoryAnalysisLogger implements AnalysisLogger {
  readonly warnings: { readonly context: unknown; readonly message: string }[] = []

  warn(context: unknown, message: string): void {
    this.warnings.push({ context, message })
  }
}

class SequentialIdGenerator {
  private sequence = 0

  generate(): string {
    this.sequence += 1
    return `id-${this.sequence}`
  }
}

class InMemoryUnitOfWork {
  runCount = 0

  async run<T>(operation: () => Promise<T>): Promise<T> {
    this.runCount += 1
    return operation()
  }
}

const processingContext: SessionProcessingContext = {
  sessionId: 'session-1',
  accountId: 'account-1',
  themeId: 'theme-1',
  audioPath: 'recordings/session-1.webm',
  recordedAt: new Date('2026-08-21T15:29:00.000Z'),
}

const transcriptionResult: TranscriptionResult = {
  text: 'Eu apresento a ideia com clareza',
  words: [
    { word: 'Eu', start: 0, end: 0.2, confidence: 0.9 },
    { word: 'apresento', start: 0.4, end: 0.8, confidence: 0.9 },
    { word: 'a', start: 1, end: 1.1, confidence: 0.9 },
    { word: 'ideia', start: 1.3, end: 1.6, confidence: 0.9 },
    { word: 'com', start: 1.8, end: 2, confidence: 0.9 },
    { word: 'clareza', start: 2.2, end: 2.6, confidence: 0.9 },
  ],
  averageConfidence: 0.9,
  durationSeconds: 3,
}

function createDependencies(
  overrides: { readonly context?: SessionProcessingContext | null } = {},
): {
  readonly analyses: InMemoryAnalysesRepository
  readonly costs: InMemoryCostEntriesRepository
  readonly clock: ControllableClock
  readonly dependencies: ProcessSessionAudioDependencies
  readonly evaluation: InMemoryEvaluationPort
  readonly events: FakeEventBus
  readonly logger: InMemoryAnalysisLogger
  readonly transcription: InMemoryTranscriptionPort
  readonly transcriptions: InMemoryTranscriptionsRepository
  readonly unitOfWork: InMemoryUnitOfWork
} {
  const clock = new ControllableClock(new Date('2026-08-21T15:30:00.000Z'))
  const analyses = new InMemoryAnalysesRepository()
  const costs = new InMemoryCostEntriesRepository()
  const events = new FakeEventBus()
  const logger = new InMemoryAnalysisLogger()
  const transcription = new InMemoryTranscriptionPort(transcriptionResult)
  const evaluation = new InMemoryEvaluationPort(
    {
      clarityScore: 80,
      clarityGuidance: 'Clareza.',
      fluencyScore: 90,
      fluencyGuidance: 'Fluência.',
      masteryScore: 70,
      masteryGuidance: 'Domínio.',
      inputTokens: 1_000,
      outputTokens: 500,
    },
    clock,
  )
  const transcriptions = new InMemoryTranscriptionsRepository()
  const unitOfWork = new InMemoryUnitOfWork()
  const context = overrides.context === undefined ? processingContext : overrides.context

  return {
    analyses,
    costs,
    clock,
    dependencies: {
      accounts: new InMemoryAccountsPort(),
      analyses,
      audioReader: new InMemoryAudioReader(),
      clock,
      costRates: {
        transcriptionCostPerMinuteMicros: 10_000,
        geminiInputCostPerMtokMicros: 100,
        geminiOutputCostPerMtokMicros: 200,
      },
      costs,
      evaluation,
      eventPublisher: events,
      idGenerator: new SequentialIdGenerator(),
      logger,
      sessions: new InMemorySessionsPort(context),
      themes: new InMemoryThemesPort(),
      transcription,
      transcriptions,
      unitOfWork,
    },
    evaluation,
    events,
    logger,
    transcription,
    transcriptions,
    unitOfWork,
  }
}

describe('ProcessSessionAudioUseCase', () => {
  afterEach(() => {
    vi.useRealTimers()
  })
  it('processes, persists and publishes a completed analysis', async () => {
    const {
      analyses,
      costs,
      dependencies,
      evaluation,
      events,
      transcription,
      transcriptions,
      unitOfWork,
    } = createDependencies()
    const useCase = new ProcessSessionAudioUseCase(dependencies)

    await expect(useCase.execute({ sessionId: 'session-1' })).resolves.toBeUndefined()

    expect(transcription.received).toHaveLength(1)
    expect(evaluation.received).toMatchObject([
      {
        themeTitle: 'Speaking with confidence',
        transcript: 'Eu apresento a ideia com clareza',
        rhythm: { wordsPerMinute: 138 },
      },
    ])
    expect(transcriptions.saved).toHaveLength(1)
    expect(analyses.saved).toHaveLength(1)
    expect(costs.saved).toMatchObject([{ sessionId: 'session-1', totalMicrosUsd: 502 }])
    expect(unitOfWork.runCount).toBe(1)
    expect(analyses.saved[0]).toMatchObject({
      rhythmScore: { value: 100 },
      rhythmGuidance:
        'Seu ritmo ficou na faixa confortável de escuta e as pausas sustentaram o encadeamento das ideias.',
      processingMs: 1_500,
      costMicrosUsd: 502,
      totalScore: 85,
    })
    expect(events.published).toMatchObject([
      {
        eventName: 'analysis_completed',
        payload: {
          sessionId: 'session-1',
          accountId: 'account-1',
          plan: 'free',
          scores: { clarity: 80, rhythm: 100, fluency: 90, mastery: 70, total: 85 },
          processingMs: 1_500,
          costMicrosUsd: 502,
        },
      },
    ])
  })

  it('does not reprocess an existing analysis', async () => {
    const { analyses, dependencies, events, transcription } = createDependencies()
    const useCase = new ProcessSessionAudioUseCase(dependencies)

    await useCase.execute({ sessionId: 'session-1' })
    await useCase.execute({ sessionId: 'session-1' })

    expect(analyses.saved).toHaveLength(1)
    expect(transcription.received).toHaveLength(1)
    expect(events.published).toHaveLength(1)
  })

  it('logs and returns silently when the session has no processing context', async () => {
    const { dependencies, events, logger, transcription } = createDependencies({ context: null })
    const useCase = new ProcessSessionAudioUseCase(dependencies)

    await expect(useCase.execute({ sessionId: 'session-1' })).resolves.toBeUndefined()

    expect(transcription.received).toEqual([])
    expect(events.published).toEqual([])
    expect(logger.warnings).toMatchObject([
      { context: { sessionId: 'session-1' }, message: 'analysis_target_missing' },
    ])
  })

  it('logs and returns silently when the account plan does not resolve', async () => {
    const { dependencies, events, logger, transcription } = createDependencies()
    const useCase = new ProcessSessionAudioUseCase({
      ...dependencies,
      accounts: { findPlan: () => Promise.resolve(null) },
    })

    await expect(useCase.execute({ sessionId: 'session-1' })).resolves.toBeUndefined()

    expect(transcription.received).toEqual([])
    expect(events.published).toEqual([])
    expect(logger.warnings).toMatchObject([
      {
        context: { sessionId: 'session-1', accountId: 'account-1' },
        message: 'analysis_target_missing',
      },
    ])
  })

  it('publishes a transcription failure without persisting when transcription fails', async () => {
    const { analyses, costs, dependencies, events, transcription, transcriptions } =
      createDependencies()
    const original = new EvaluationFailedError('provider unavailable')
    transcription.failNext(original)
    const useCase = new ProcessSessionAudioUseCase(dependencies)

    await expect(useCase.execute({ sessionId: 'session-1' })).rejects.toMatchObject({
      code: 'analyses.TRANSCRIPTION_FAILED',
      cause: original,
    })

    expect(transcriptions.saved).toEqual([])
    expect(analyses.saved).toEqual([])
    expect(costs.saved).toEqual([])
    expect(events.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'transcription_failed' } },
    ])
  })

  it('publishes a transcription failure before calculating rhythm for an empty transcript', async () => {
    const { analyses, costs, dependencies, events, transcriptions } = createDependencies()
    const useCase = new ProcessSessionAudioUseCase({
      ...dependencies,
      transcription: {
        transcribe: () => Promise.resolve({ ...transcriptionResult, words: [] }),
      },
    })

    await expect(useCase.execute({ sessionId: 'session-1' })).rejects.toMatchObject({
      code: 'analyses.TRANSCRIPTION_FAILED',
    })

    expect(transcriptions.saved).toEqual([])
    expect(analyses.saved).toEqual([])
    expect(costs.saved).toEqual([])
    expect(events.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'transcription_failed' } },
    ])
  })

  it('publishes a transcription failure when the speech duration is zero', async () => {
    const { analyses, costs, dependencies, events, transcriptions } = createDependencies()
    const useCase = new ProcessSessionAudioUseCase({
      ...dependencies,
      transcription: {
        transcribe: () =>
          Promise.resolve({
            ...transcriptionResult,
            words: [{ word: 'Eu', start: 1, end: 1, confidence: 0.9 }],
          }),
      },
    })

    await expect(useCase.execute({ sessionId: 'session-1' })).rejects.toMatchObject({
      code: 'analyses.TRANSCRIPTION_FAILED',
    })

    expect(transcriptions.saved).toEqual([])
    expect(analyses.saved).toEqual([])
    expect(costs.saved).toEqual([])
    expect(events.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'transcription_failed' } },
    ])
  })

  it('publishes an evaluation failure and throws when the theme title does not resolve', async () => {
    const { analyses, costs, dependencies, events, transcriptions } = createDependencies()
    const useCase = new ProcessSessionAudioUseCase({
      ...dependencies,
      themes: new InMemoryThemesPort(null),
    })

    await expect(useCase.execute({ sessionId: 'session-1' })).rejects.toMatchObject({
      code: 'analyses.EVALUATION_FAILED',
    })

    expect(transcriptions.saved).toEqual([])
    expect(analyses.saved).toEqual([])
    expect(costs.saved).toEqual([])
    expect(events.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'evaluation_failed' } },
    ])
  })

  it('publishes an evaluation failure without persisting when evaluation fails', async () => {
    const { analyses, costs, dependencies, events, transcriptions } = createDependencies()
    const original = new EvaluationFailedError('provider unavailable')
    const useCase = new ProcessSessionAudioUseCase({
      ...dependencies,
      evaluation: {
        evaluate: () => Promise.reject(original),
      },
    })

    await expect(useCase.execute({ sessionId: 'session-1' })).rejects.toBe(original)

    expect(transcriptions.saved).toEqual([])
    expect(analyses.saved).toEqual([])
    expect(costs.saved).toEqual([])
    expect(events.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'evaluation_failed' } },
    ])
  })

  it('publishes a malformed evaluation failure without persisting an analysis', async () => {
    const { analyses, dependencies, events } = createDependencies()
    const malformed = new MalformedEvaluationError('schema')
    const useCase = new ProcessSessionAudioUseCase({
      ...dependencies,
      evaluation: {
        evaluate: () => Promise.reject(malformed),
      },
    })

    await expect(useCase.execute({ sessionId: 'session-1' })).rejects.toBe(malformed)

    expect(analyses.saved).toEqual([])
    expect(events.published).toMatchObject([
      { eventName: 'analysis_failed', payload: { reason: 'malformed_evaluation' } },
    ])
  })

  it('publishes a timeout and throws without calling external ports when the deadline elapsed', async () => {
    const { analyses, costs, dependencies, events, transcription } = createDependencies({
      context: { ...processingContext, recordedAt: new Date('2026-08-21T15:24:59.000Z') },
    })
    const useCase = new ProcessSessionAudioUseCase(dependencies)

    await expect(useCase.execute({ sessionId: 'session-1' })).rejects.toBeInstanceOf(
      AnalysisDeadlineExceededError,
    )

    expect(transcription.received).toEqual([])
    expect(analyses.saved).toEqual([])
    expect(costs.saved).toEqual([])
    expect(events.published).toMatchObject([{ eventName: 'analysis_timeout' }])
  })

  it('classifies an aborted transcription as a timeout even though the provider rejects with an infrastructure error', async () => {
    vi.useFakeTimers()
    const { clock, dependencies, events, transcription } = createDependencies({
      context: { ...processingContext, recordedAt: new Date('2026-08-21T15:29:30.000Z') },
    })
    transcription.hangUntilAborted()
    const useCase = new ProcessSessionAudioUseCase(dependencies)

    const processing = useCase.execute({ sessionId: 'session-1' })
    const rejected = expect(processing).rejects.toBeInstanceOf(AnalysisDeadlineExceededError)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(270_000)
    clock.advance(270_000)

    await rejected
    expect(transcription.received).toMatchObject([{ deadlineMs: 270_000 }])
    expect(events.published).toMatchObject([{ eventName: 'analysis_timeout' }])
  })

  it('classifies an aborted evaluation as a timeout even though the provider rejects with an infrastructure error', async () => {
    vi.useFakeTimers()
    const { clock, dependencies, events, evaluation } = createDependencies({
      context: { ...processingContext, recordedAt: new Date('2026-08-21T15:29:30.000Z') },
    })
    evaluation.hangUntilAborted()
    const useCase = new ProcessSessionAudioUseCase(dependencies)

    const processing = useCase.execute({ sessionId: 'session-1' })
    const rejected = expect(processing).rejects.toBeInstanceOf(AnalysisDeadlineExceededError)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(270_000)
    clock.advance(270_000)

    await rejected
    expect(events.published).toMatchObject([{ eventName: 'analysis_timeout' }])
  })
})
