import type { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import type { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { EvaluationResult } from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import type { SessionProcessingContext } from '@/modules/analyses/domain/ports/sessions-port/index.js'
import type { TranscriptionResult } from '@/modules/analyses/domain/ports/transcription-port/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'
import { describe, expect, it } from 'vitest'

import { ProcessSessionAudioUseCase } from './index.js'
import type { ProcessSessionAudioDependencies } from './types.js'

class InMemoryAnalysesRepository {
  readonly saved: Analysis[] = []

  findBySessionId(): Promise<Analysis | null> {
    return Promise.resolve(null)
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
  constructor(private readonly context: SessionProcessingContext) {}

  findProcessingContext(): Promise<SessionProcessingContext> {
    return Promise.resolve(this.context)
  }
}

class InMemoryAudioReader {
  readonly readSessionIds: string[] = []

  read(sessionId: string): Promise<Buffer> {
    this.readSessionIds.push(sessionId)
    return Promise.resolve(Buffer.from('audio'))
  }
}

class InMemoryTranscriptionPort {
  readonly received: { readonly audio: Buffer; readonly deadlineMs: number }[] = []

  constructor(private readonly result: TranscriptionResult) {}

  transcribe(input: {
    readonly audio: Buffer
    readonly deadlineMs: number
    readonly signal: AbortSignal
  }): Promise<TranscriptionResult> {
    this.received.push({ audio: input.audio, deadlineMs: input.deadlineMs })
    return Promise.resolve(this.result)
  }
}

class InMemoryThemesPort {
  findTitle(): Promise<string> {
    return Promise.resolve('Speaking with confidence')
  }
}

class InMemoryEvaluationPort {
  readonly received: {
    readonly themeTitle: string
    readonly transcript: string
    readonly rhythm: { readonly wordsPerMinute: number }
  }[] = []

  constructor(
    private readonly result: EvaluationResult,
    private readonly clock: ControllableClock,
  ) {}

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
    this.clock.advance(1_500)
    return Promise.resolve(this.result)
  }
}

class InMemoryAccountsPort {
  findPlan(): Promise<AccountPlan> {
    return Promise.resolve('free')
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

function createDependencies(): {
  readonly analyses: InMemoryAnalysesRepository
  readonly costs: InMemoryCostEntriesRepository
  readonly dependencies: ProcessSessionAudioDependencies
  readonly evaluation: InMemoryEvaluationPort
  readonly events: FakeEventBus
  readonly transcription: InMemoryTranscriptionPort
  readonly transcriptions: InMemoryTranscriptionsRepository
  readonly unitOfWork: InMemoryUnitOfWork
} {
  const clock = new ControllableClock(new Date('2026-08-21T15:30:00.000Z'))
  const analyses = new InMemoryAnalysesRepository()
  const costs = new InMemoryCostEntriesRepository()
  const events = new FakeEventBus()
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

  return {
    analyses,
    costs,
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
      sessions: new InMemorySessionsPort({
        sessionId: 'session-1',
        accountId: 'account-1',
        themeId: 'theme-1',
        audioPath: 'recordings/session-1.webm',
        recordedAt: new Date('2026-08-21T15:29:00.000Z'),
      }),
      themes: new InMemoryThemesPort(),
      transcription,
      transcriptions,
      unitOfWork,
    },
    evaluation,
    events,
    transcription,
    transcriptions,
    unitOfWork,
  }
}

describe('ProcessSessionAudioUseCase', () => {
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
})
