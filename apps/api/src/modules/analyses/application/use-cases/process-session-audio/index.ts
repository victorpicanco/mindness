import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import { AnalysisCompleted } from '@/modules/analyses/domain/events/analysis-completed/index.js'
import { CostCalculator } from '@/modules/analyses/domain/services/cost-calculator/index.js'
import { RhythmCalculator } from '@/modules/analyses/domain/services/rhythm-calculator/index.js'
import { PillarScore } from '@/modules/analyses/domain/value-objects/pillar-score/index.js'

import type {
  PersistedAnalysis,
  ProcessSessionAudioDependencies,
  ProcessSessionAudioInput,
  ProcessSessionAudioOutput,
} from './types.js'

const ANALYSIS_DEADLINE_MS = 300_000

export class ProcessSessionAudioUseCase {
  constructor(private readonly dependencies: ProcessSessionAudioDependencies) {}

  async execute(input: ProcessSessionAudioInput): Promise<ProcessSessionAudioOutput> {
    const existingAnalysis = await this.dependencies.analyses.findBySessionId(input.sessionId)
    if (existingAnalysis !== null) return

    const context = await this.dependencies.sessions.findProcessingContext(input.sessionId)
    if (context === null) return

    const plan = await this.dependencies.accounts.findPlan(context.accountId)
    if (plan === null) return

    const startedAt = this.dependencies.clock.now()
    const controller = new AbortController()
    const audio = await this.dependencies.audioReader.read(context.sessionId)
    const transcriptionResult = await this.dependencies.transcription.transcribe({
      audio,
      deadlineMs: ANALYSIS_DEADLINE_MS,
      signal: controller.signal,
    })
    const rhythm = calculateRhythm(transcriptionResult.words)
    if (rhythm === null) return

    const themeTitle = await this.dependencies.themes.findTitle(context.themeId)
    if (themeTitle === null) return

    const evaluation = await this.dependencies.evaluation.evaluate({
      themeTitle,
      transcript: transcriptionResult.text,
      rhythm: rhythm.metrics,
      signal: controller.signal,
    })
    const completedAt = this.dependencies.clock.now()
    const persisted = createPersistedAnalysis({
      context,
      transcriptionResult,
      evaluation,
      rhythm,
      startedAt,
      completedAt,
      dependencies: this.dependencies,
    })

    await this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.transcriptions.save(persisted.transcription)
      await this.dependencies.analyses.save(persisted.analysis)
      await this.dependencies.costs.save(persisted.costEntry)
    })
    await this.dependencies.eventPublisher.publish(
      AnalysisCompleted.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt: completedAt,
        sessionId: context.sessionId,
        accountId: context.accountId,
        plan,
        scores: {
          clarity: persisted.analysis.clarityScore.value,
          rhythm: persisted.analysis.rhythmScore.value,
          fluency: persisted.analysis.fluencyScore.value,
          mastery: persisted.analysis.masteryScore.value,
          total: persisted.analysis.totalScore,
        },
        processingMs: persisted.analysis.processingMs,
        costMicrosUsd: persisted.analysis.costMicrosUsd,
      }),
    )
  }
}

function calculateRhythm(
  words: readonly {
    readonly word: string
    readonly start: number
    readonly end: number
    readonly confidence: number
  }[],
) {
  const [firstWord, ...remainingWords] = words
  if (firstWord === undefined) return null

  return RhythmCalculator.calculate([firstWord, ...remainingWords])
}

function createPersistedAnalysis(input: {
  readonly context: { readonly sessionId: string; readonly accountId: string }
  readonly transcriptionResult: {
    readonly text: string
    readonly words: readonly {
      readonly word: string
      readonly start: number
      readonly end: number
      readonly confidence: number
    }[]
    readonly durationSeconds: number
  }
  readonly evaluation: {
    readonly clarityScore: number
    readonly clarityGuidance: string
    readonly fluencyScore: number
    readonly fluencyGuidance: string
    readonly masteryScore: number
    readonly masteryGuidance: string
    readonly inputTokens: number
    readonly outputTokens: number
  }
  readonly rhythm: ReturnType<typeof calculateRhythm> & {}
  readonly startedAt: Date
  readonly completedAt: Date
  readonly dependencies: ProcessSessionAudioDependencies
}): PersistedAnalysis {
  const cost = CostCalculator.calculate({
    durationSeconds: input.transcriptionResult.durationSeconds,
    inputTokens: input.evaluation.inputTokens,
    candidatesTokenCount: input.evaluation.outputTokens,
    thoughtsTokenCount: 0,
    ...input.dependencies.costRates,
  })
  const transcription = Transcription.create({
    transcriptionId: input.dependencies.idGenerator.generate(),
    sessionId: input.context.sessionId,
    text: input.transcriptionResult.text,
    words: input.transcriptionResult.words,
    durationSeconds: input.transcriptionResult.durationSeconds,
    createdAt: input.completedAt,
  })
  const analysis = Analysis.create({
    analysisId: input.dependencies.idGenerator.generate(),
    sessionId: input.context.sessionId,
    clarityScore: PillarScore.create(input.evaluation.clarityScore),
    rhythmScore: PillarScore.create(input.rhythm.score),
    fluencyScore: PillarScore.create(input.evaluation.fluencyScore),
    masteryScore: PillarScore.create(input.evaluation.masteryScore),
    clarityGuidance: input.evaluation.clarityGuidance,
    rhythmGuidance: input.rhythm.guidance,
    fluencyGuidance: input.evaluation.fluencyGuidance,
    masteryGuidance: input.evaluation.masteryGuidance,
    rhythmMetrics: input.rhythm.metrics,
    processingMs: input.completedAt.getTime() - input.startedAt.getTime(),
    costMicrosUsd: cost.totalMicrosUsd,
    createdAt: input.completedAt,
  })

  return {
    transcription,
    analysis,
    costEntry: {
      id: input.dependencies.idGenerator.generate(),
      sessionId: input.context.sessionId,
      accountId: input.context.accountId,
      transcriptionMicrosUsd: cost.transcriptionMicrosUsd,
      evaluationMicrosUsd: cost.evaluationMicrosUsd,
      totalMicrosUsd: cost.totalMicrosUsd,
      incurredAt: input.completedAt,
    },
  }
}

export type {
  ProcessSessionAudioDependencies,
  ProcessSessionAudioInput,
  ProcessSessionAudioOutput,
} from './types.js'
