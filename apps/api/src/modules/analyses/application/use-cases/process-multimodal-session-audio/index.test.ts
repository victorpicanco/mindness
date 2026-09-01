import { CommunicationAnalysis } from '@/modules/analyses/domain/entities/communication-analysis/index.js'
import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { AnalysisLogger } from '@/modules/analyses/domain/ports/analysis-logger/index.js'
import type {
  PrepareAudioInput,
  PreparedAudio,
} from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import { CANONICAL_AUDIO_CONTENT_TYPE } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import type { AudioContent } from '@/modules/analyses/domain/ports/audio-reader-port/index.js'
import type { AuditoryAnalysisResult } from '@/modules/analyses/domain/ports/auditory-analysis-port/index.js'
import type {
  AnalysisAccess,
  SessionProcessingContext,
} from '@/modules/analyses/domain/ports/sessions-port/index.js'
import type {
  FeedbackSynthesisInput,
  FeedbackSynthesisResult,
} from '@/modules/analyses/domain/ports/feedback-synthesis-port/index.js'
import type { AnalysisCostEntry } from '@/modules/analyses/domain/entities/analysis-cost-entry/index.js'
import type { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import type { TranscriptionResult } from '@/modules/analyses/domain/ports/transcription-port/index.js'
import { AnalysisDeadlineExceededError } from '@/modules/analyses/domain/errors/analysis-deadline-exceeded-error/index.js'
import { CommunicationFeedback } from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'
import { describe, expect, it } from 'vitest'

import { ProcessMultimodalSessionAudioUseCase } from './index.js'
import type { ProcessMultimodalSessionAudioDependencies } from './types.js'

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

function createDeferred<T>(): Deferred<T> {
  let settle: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })

  return { promise, resolve: (value) => settle(value) }
}

const SOURCE_BYTES = Buffer.from('original-webm')
const PREPARED_BYTES = Buffer.from('canonical-flac')

class InMemoryCommunicationAnalysesRepository {
  readonly saved: CommunicationAnalysis[] = []

  findBySessionId(sessionId: string): Promise<CommunicationAnalysis | null> {
    return Promise.resolve(this.saved.find((entry) => entry.sessionId === sessionId) ?? null)
  }

  save(analysis: CommunicationAnalysis): Promise<void> {
    this.saved.push(analysis)
    return Promise.resolve()
  }
}

class InMemorySessionsPort {
  constructor(private readonly context: SessionProcessingContext | null) {}

  findProcessingContext(): Promise<SessionProcessingContext | null> {
    return Promise.resolve(this.context)
  }

  listStuckProcessing(): Promise<readonly string[]> {
    return Promise.resolve([])
  }

  checkAnalysisAccess(): Promise<AnalysisAccess> {
    return Promise.resolve({ failure: null, readable: false })
  }
}

class InMemoryAccountsPort {
  constructor(private readonly plan: AccountPlan | null = 'free') {}

  findPlan(): Promise<AccountPlan | null> {
    return Promise.resolve(this.plan)
  }

  resolveAccountId(): Promise<string | null> {
    return Promise.resolve(null)
  }
}

class CountingAudioReader {
  callCount = 0

  read(): Promise<AudioContent> {
    this.callCount += 1
    return Promise.resolve({
      bytes: SOURCE_BYTES,
      contentType: 'audio/webm',
      durationSeconds: 30,
    })
  }
}

class CountingAudioPreparation {
  readonly received: PrepareAudioInput[] = []

  prepare(input: PrepareAudioInput): Promise<PreparedAudio> {
    this.received.push(input)
    return Promise.resolve({
      bytes: PREPARED_BYTES,
      contentType: CANONICAL_AUDIO_CONTENT_TYPE,
      durationSeconds: input.source.durationSeconds,
    })
  }
}

class DeferredAuditoryAnalysisPort {
  readonly received: { readonly audio: PreparedAudio; readonly signal: AbortSignal }[] = []
  private readonly invoked = createDeferred<void>()
  private readonly answer = createDeferred<AuditoryAnalysisResult>()

  get called(): Promise<void> {
    return this.invoked.promise
  }

  observe(input: {
    readonly audio: PreparedAudio
    readonly signal: AbortSignal
  }): Promise<AuditoryAnalysisResult> {
    this.received.push(input)
    this.invoked.resolve()
    return this.answer.promise
  }

  release(result: AuditoryAnalysisResult): void {
    this.answer.resolve(result)
  }
}

class DeferredTranscriptionPort {
  readonly received: { readonly audio: Buffer; readonly deadlineMs: number }[] = []
  private readonly invoked = createDeferred<void>()
  private readonly answer = createDeferred<TranscriptionResult>()

  get called(): Promise<void> {
    return this.invoked.promise
  }

  transcribe(input: {
    readonly audio: Buffer
    readonly deadlineMs: number
    readonly signal: AbortSignal
  }): Promise<TranscriptionResult> {
    this.received.push({ audio: input.audio, deadlineMs: input.deadlineMs })
    this.invoked.resolve()
    return this.answer.promise
  }

  release(result: TranscriptionResult): void {
    this.answer.resolve(result)
  }
}

class RecordingFeedbackSynthesisPort {
  readonly received: FeedbackSynthesisInput[] = []

  constructor(
    private readonly result: FeedbackSynthesisResult,
    private readonly clock: ControllableClock,
  ) {}

  synthesize(input: FeedbackSynthesisInput): Promise<FeedbackSynthesisResult> {
    this.received.push(input)
    this.clock.advance(1_500)
    return Promise.resolve(this.result)
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
  readonly saved: AnalysisCostEntry[] = []

  save(entry: AnalysisCostEntry): Promise<void> {
    this.saved.push(entry)
    return Promise.resolve()
  }

  sumMicrosBetween(): Promise<number> {
    return Promise.resolve(0)
  }
}

class InMemoryUnitOfWork {
  runCount = 0
  savesInsideRun = 0

  constructor(
    private readonly transcriptions: InMemoryTranscriptionsRepository,
    private readonly analyses: InMemoryCommunicationAnalysesRepository,
    private readonly costs: InMemoryCostEntriesRepository,
  ) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    this.runCount += 1
    const result = await operation()
    this.savesInsideRun =
      this.transcriptions.saved.length + this.analyses.saved.length + this.costs.saved.length
    return result
  }
}

class CountingThemesPort {
  callCount = 0

  findTitle(): Promise<string | null> {
    this.callCount += 1
    return Promise.resolve('Speaking with confidence')
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

const processingContext: SessionProcessingContext = {
  sessionId: 'session-1',
  accountId: 'account-1',
  themeId: 'theme-1',
  audioPath: 'recordings/session-1.webm',
  recordedAt: new Date('2026-08-21T15:29:00.000Z'),
}

const existingAnalysis = CommunicationAnalysis.create({
  analysisId: 'analysis-1',
  sessionId: 'session-1',
  promptVersion: 'speech-feedback-v1',
  feedback: CommunicationFeedback.create({
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
  }),
  processingMs: 1_000,
  costMicrosUsd: 100,
  createdAt: new Date('2026-08-21T15:30:00.000Z'),
})

const auditoryResult: AuditoryAnalysisResult = {
  observation: {
    audioUsability: 'usable',
    limitations: [],
    literalTranscript: 'Eu ééé apresento a ideia',
    mainMessage: 'A pessoa apresenta a ideia principal',
    attemptedStructure: 'Abertura, desenvolvimento e fecho',
    deliverySummary: 'Entrega estável com alongamentos ocasionais',
    candidateEvents: [],
  },
  inputTokens: 900,
  outputTokens: 300,
}

const synthesizedFeedback = CommunicationFeedback.create({
  durationSeconds: 30,
  audioUsability: 'usable',
  alignmentQuality: 'reliable',
  limitations: [],
  literalTranscript: 'Eu ééé apresento a ideia com clareza',
  mainMessage: 'A pessoa defende a ideia principal.',
  attemptedStructure: 'Abertura, argumento e fecho.',
  summary: 'A mensagem chega inteira. Um alongamento abre o argumento.',
  strengths: [],
  moments: [],
  patterns: [],
  asrDivergences: [],
  priorities: [],
})

const synthesisResult: FeedbackSynthesisResult = {
  feedback: synthesizedFeedback,
  inputTokens: 1_000,
  outputTokens: 500,
}

const transcriptionResult: TranscriptionResult = {
  text: 'Eu apresento a ideia com clareza',
  words: [
    { word: 'Eu', start: 0, end: 0.2, confidence: 0.9 },
    { word: 'apresento', start: 0.4, end: 0.8, confidence: 0.9 },
    { word: 'a', start: 1, end: 1.1, confidence: 0.9 },
    { word: 'ideia', start: 1.3, end: 1.6, confidence: 0.9 },
  ],
  averageConfidence: 0.9,
  durationSeconds: 3,
}

function createDependencies(
  overrides: {
    readonly context?: SessionProcessingContext | null
    readonly plan?: AccountPlan | null
  } = {},
): {
  readonly audioPreparation: CountingAudioPreparation
  readonly audioReader: CountingAudioReader
  readonly auditoryAnalysis: DeferredAuditoryAnalysisPort
  readonly clock: ControllableClock
  readonly communicationAnalyses: InMemoryCommunicationAnalysesRepository
  readonly costs: InMemoryCostEntriesRepository
  readonly dependencies: ProcessMultimodalSessionAudioDependencies
  readonly events: FakeEventBus
  readonly feedbackSynthesis: RecordingFeedbackSynthesisPort
  readonly logger: InMemoryAnalysisLogger
  readonly themes: CountingThemesPort
  readonly transcription: DeferredTranscriptionPort
  readonly transcriptions: InMemoryTranscriptionsRepository
  readonly unitOfWork: InMemoryUnitOfWork
} {
  const clock = new ControllableClock(new Date('2026-08-21T15:30:00.000Z'))
  const audioPreparation = new CountingAudioPreparation()
  const audioReader = new CountingAudioReader()
  const auditoryAnalysis = new DeferredAuditoryAnalysisPort()
  const communicationAnalyses = new InMemoryCommunicationAnalysesRepository()
  const events = new FakeEventBus()
  const logger = new InMemoryAnalysisLogger()
  const themes = new CountingThemesPort()
  const transcription = new DeferredTranscriptionPort()
  const feedbackSynthesis = new RecordingFeedbackSynthesisPort(synthesisResult, clock)
  const transcriptions = new InMemoryTranscriptionsRepository()
  const costs = new InMemoryCostEntriesRepository()
  const unitOfWork = new InMemoryUnitOfWork(transcriptions, communicationAnalyses, costs)
  const context = overrides.context === undefined ? processingContext : overrides.context
  const plan = overrides.plan === undefined ? 'free' : overrides.plan

  return {
    audioPreparation,
    audioReader,
    auditoryAnalysis,
    clock,
    communicationAnalyses,
    costs,
    dependencies: {
      accounts: new InMemoryAccountsPort(plan),
      audioPreparation,
      audioReader,
      auditoryAnalysis,
      clock,
      communicationAnalyses,
      costRates: {
        transcriptionCostPerMinuteMicros: 10_000,
        geminiInputCostPerMtokMicros: 100,
        geminiOutputCostPerMtokMicros: 200,
      },
      costs,
      eventPublisher: events,
      feedbackSynthesis,
      idGenerator: new SequentialIdGenerator(),
      logger,
      sessions: new InMemorySessionsPort(context),
      themes,
      transcription,
      transcriptions,
      unitOfWork,
    },
    events,
    feedbackSynthesis,
    logger,
    themes,
    transcription,
    transcriptions,
    unitOfWork,
  }
}

describe('ProcessMultimodalSessionAudioUseCase', () => {
  it('starts the auditory analysis and the transcription before either one answers', async () => {
    const { auditoryAnalysis, dependencies, transcription } = createDependencies()
    const useCase = new ProcessMultimodalSessionAudioUseCase(dependencies)

    const execution = useCase.execute({ sessionId: 'session-1' })
    await Promise.all([auditoryAnalysis.called, transcription.called])

    expect(auditoryAnalysis.received).toHaveLength(1)
    expect(transcription.received).toHaveLength(1)

    auditoryAnalysis.release(auditoryResult)
    transcription.release(transcriptionResult)
    await execution
  })

  it('reads and prepares the recording exactly once per attempt', async () => {
    const { audioPreparation, audioReader, auditoryAnalysis, dependencies, transcription } =
      createDependencies()
    const useCase = new ProcessMultimodalSessionAudioUseCase(dependencies)

    const execution = useCase.execute({ sessionId: 'session-1' })
    await Promise.all([auditoryAnalysis.called, transcription.called])
    auditoryAnalysis.release(auditoryResult)
    transcription.release(transcriptionResult)
    await execution

    expect(audioReader.callCount).toBe(1)
    expect(audioPreparation.received).toHaveLength(1)
    expect(audioPreparation.received[0]?.source.bytes).toBe(SOURCE_BYTES)
  })

  it('sends the canonical audio to Gemini and the original recording to Deepgram', async () => {
    const { auditoryAnalysis, dependencies, transcription } = createDependencies()
    const useCase = new ProcessMultimodalSessionAudioUseCase(dependencies)

    const execution = useCase.execute({ sessionId: 'session-1' })
    await Promise.all([auditoryAnalysis.called, transcription.called])

    expect(auditoryAnalysis.received[0]?.audio).toMatchObject({
      bytes: PREPARED_BYTES,
      contentType: CANONICAL_AUDIO_CONTENT_TYPE,
    })
    expect(transcription.received[0]?.audio).toBe(SOURCE_BYTES)

    auditoryAnalysis.release(auditoryResult)
    transcription.release(transcriptionResult)
    await execution
  })

  it('does not resolve the theme while the parallel stage is still running', async () => {
    const { auditoryAnalysis, dependencies, themes, transcription } = createDependencies()
    const useCase = new ProcessMultimodalSessionAudioUseCase(dependencies)

    const execution = useCase.execute({ sessionId: 'session-1' })
    await Promise.all([auditoryAnalysis.called, transcription.called])

    expect(themes.callCount).toBe(0)

    auditoryAnalysis.release(auditoryResult)
    transcription.release(transcriptionResult)
    await execution
  })

  it('feeds the synthesis with the audio, the observation, the theme and the transcription', async () => {
    const { auditoryAnalysis, dependencies, feedbackSynthesis, themes, transcription } =
      createDependencies()
    const useCase = new ProcessMultimodalSessionAudioUseCase(dependencies)

    const execution = useCase.execute({ sessionId: 'session-1' })
    await Promise.all([auditoryAnalysis.called, transcription.called])
    auditoryAnalysis.release(auditoryResult)
    transcription.release(transcriptionResult)
    await execution

    expect(themes.callCount).toBe(1)
    expect(feedbackSynthesis.received).toHaveLength(1)
    expect(feedbackSynthesis.received[0]).toMatchObject({
      audio: { bytes: PREPARED_BYTES, contentType: CANONICAL_AUDIO_CONTENT_TYPE },
      observation: auditoryResult.observation,
      themeTitle: 'Speaking with confidence',
      transcript: transcriptionResult.text,
      words: transcriptionResult.words,
      rhythm: { wordsPerMinute: 150 },
    })
  })

  it('persists the transcription, the feedback and the cost in a single transaction', async () => {
    const {
      auditoryAnalysis,
      communicationAnalyses,
      costs,
      dependencies,
      transcription,
      transcriptions,
      unitOfWork,
    } = createDependencies()
    const useCase = new ProcessMultimodalSessionAudioUseCase(dependencies)

    const execution = useCase.execute({ sessionId: 'session-1' })
    await Promise.all([auditoryAnalysis.called, transcription.called])
    auditoryAnalysis.release(auditoryResult)
    transcription.release(transcriptionResult)
    await execution

    expect(unitOfWork.runCount).toBe(1)
    expect(unitOfWork.savesInsideRun).toBe(3)
    expect(transcriptions.saved).toHaveLength(1)
    expect(communicationAnalyses.saved).toMatchObject([
      {
        sessionId: 'session-1',
        feedbackVersion: 2,
        promptVersion: 'speech-feedback-v1',
        feedback: synthesizedFeedback,
        processingMs: 1_500,
        costMicrosUsd: 504,
      },
    ])
    expect(costs.saved).toMatchObject([
      {
        sessionId: 'session-1',
        accountId: 'account-1',
        transcriptionMicrosUsd: 500,
        auditoryMicrosUsd: 2,
        synthesisMicrosUsd: 2,
        evaluationMicrosUsd: 4,
        totalMicrosUsd: 504,
      },
    ])
  })

  it('never persists the intermediate auditory observation', async () => {
    const { auditoryAnalysis, communicationAnalyses, dependencies, transcription } =
      createDependencies()
    const useCase = new ProcessMultimodalSessionAudioUseCase(dependencies)

    const execution = useCase.execute({ sessionId: 'session-1' })
    await Promise.all([auditoryAnalysis.called, transcription.called])
    auditoryAnalysis.release(auditoryResult)
    transcription.release(transcriptionResult)
    await execution

    const persisted = JSON.stringify(communicationAnalyses.saved)
    expect(persisted).not.toContain(auditoryResult.observation.deliverySummary)
    expect(persisted).not.toContain('candidateEvents')
  })

  it('publishes a completion event that carries no score', async () => {
    const { auditoryAnalysis, dependencies, events, transcription } = createDependencies()
    const useCase = new ProcessMultimodalSessionAudioUseCase(dependencies)

    const execution = useCase.execute({ sessionId: 'session-1' })
    await Promise.all([auditoryAnalysis.called, transcription.called])
    auditoryAnalysis.release(auditoryResult)
    transcription.release(transcriptionResult)
    await execution

    expect(events.published).toMatchObject([
      {
        eventName: 'analysis_completed',
        payload: {
          sessionId: 'session-1',
          accountId: 'account-1',
          plan: 'free',
          analysisVersion: 2,
          processingMs: 1_500,
          costMicrosUsd: 504,
        },
      },
    ])
    expect(Object.keys(events.published[0]?.payload ?? {})).not.toContain('scores')
  })

  it('skips a session that already has a communication analysis', async () => {
    const { audioReader, communicationAnalyses, dependencies } = createDependencies()
    const useCase = new ProcessMultimodalSessionAudioUseCase(dependencies)
    communicationAnalyses.saved.push(existingAnalysis)

    await expect(useCase.execute({ sessionId: 'session-1' })).resolves.toBeUndefined()

    expect(audioReader.callCount).toBe(0)
  })

  it('skips a session without a processing context', async () => {
    const { audioReader, dependencies, logger } = createDependencies({ context: null })
    const useCase = new ProcessMultimodalSessionAudioUseCase(dependencies)

    await expect(useCase.execute({ sessionId: 'session-1' })).resolves.toBeUndefined()

    expect(audioReader.callCount).toBe(0)
    expect(logger.warnings).toMatchObject([{ message: 'analysis_target_missing' }])
  })

  it('skips a session whose account no longer exists', async () => {
    const { audioReader, dependencies, logger } = createDependencies({ plan: null })
    const useCase = new ProcessMultimodalSessionAudioUseCase(dependencies)

    await expect(useCase.execute({ sessionId: 'session-1' })).resolves.toBeUndefined()

    expect(audioReader.callCount).toBe(0)
    expect(logger.warnings).toMatchObject([{ message: 'analysis_account_missing' }])
  })

  it('times out without touching the providers once the deadline has passed', async () => {
    const { audioReader, clock, dependencies, events } = createDependencies()
    const useCase = new ProcessMultimodalSessionAudioUseCase(dependencies)
    clock.set(new Date('2026-08-21T15:35:00.000Z'))

    await expect(useCase.execute({ sessionId: 'session-1' })).rejects.toBeInstanceOf(
      AnalysisDeadlineExceededError,
    )

    expect(audioReader.callCount).toBe(0)
    expect(events.published).toMatchObject([
      { eventName: 'analysis_timeout', payload: { sessionId: 'session-1', plan: 'free' } },
    ])
  })
})
