import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import { AnalysisCompleted } from '@/modules/analyses/domain/events/analysis-completed/index.js'
import { AnalysisFailed } from '@/modules/analyses/domain/events/analysis-failed/index.js'
import { AnalysisTimedOut } from '@/modules/analyses/domain/events/analysis-timed-out/index.js'
import { AnalysisDeadlineExceededError } from '@/modules/analyses/domain/errors/analysis-deadline-exceeded-error/index.js'
import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'
import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import { TranscriptionFailedError } from '@/modules/analyses/domain/errors/transcription-failed-error/index.js'
import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import { CostCalculator } from '@/modules/analyses/domain/services/cost-calculator/index.js'
import { RhythmCalculator } from '@/modules/analyses/domain/services/rhythm-calculator/index.js'
import { PillarScore } from '@/modules/analyses/domain/value-objects/pillar-score/index.js'
import type { EvaluationResult } from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import type { IdGenerator } from '@/modules/analyses/domain/ports/id-generator/index.js'
import type { TranscriptionResult } from '@/modules/analyses/domain/ports/transcription-port/index.js'

import type {
  PersistedAnalysis,
  ProcessingCostRates,
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
    if (context === null) {
      this.dependencies.logger.warn({ sessionId: input.sessionId }, 'analysis_target_missing')
      return
    }

    const plan = await this.dependencies.accounts.findPlan(context.accountId)
    if (plan === null) {
      this.dependencies.logger.warn(
        { sessionId: context.sessionId, accountId: context.accountId },
        'analysis_account_missing',
      )
      return
    }

    const remainingMs =
      ANALYSIS_DEADLINE_MS -
      (this.dependencies.clock.now().getTime() - context.recordedAt.getTime())
    if (remainingMs <= 0) {
      await this.publishTimeout(context, plan)
      throw new AnalysisDeadlineExceededError(remainingMs)
    }

    const startedAt = this.dependencies.clock.now()
    const controller = new AbortController()
    const deadlineTimer = setTimeout(() => controller.abort(), remainingMs)
    try {
      let transcriptionResult: TranscriptionResult
      try {
        const audio = await this.dependencies.audioReader.read(context.sessionId)
        transcriptionResult = await this.dependencies.transcription.transcribe({
          audio: audio.bytes,
          deadlineMs: remainingMs,
          signal: controller.signal,
        })
      } catch (error) {
        if (controller.signal.aborted) {
          await this.publishTimeout(context, plan)
          throw new AnalysisDeadlineExceededError(remainingMs)
        }
        const failure = new TranscriptionFailedError('provider request failed', { cause: error })
        await this.publishFailure({ context, plan, reason: 'transcription_failed' })
        throw failure
      }
      const rhythm = calculateRhythm(transcriptionResult.words)
      if (rhythm === null) {
        const failure = new TranscriptionFailedError('transcription has no words')
        await this.publishFailure({ context, plan, reason: 'transcription_failed' })
        throw failure
      }

      const themeTitle = await this.dependencies.themes.findTitle(context.themeId)
      if (themeTitle === null) {
        const failure = new EvaluationFailedError('theme not found')
        await this.publishFailure({ context, plan, reason: 'evaluation_failed' })
        throw failure
      }

      let evaluation: EvaluationResult
      try {
        evaluation = await this.dependencies.evaluation.evaluate({
          themeTitle,
          transcript: transcriptionResult.text,
          rhythm: rhythm.metrics,
          signal: controller.signal,
        })
      } catch (error) {
        if (controller.signal.aborted) {
          await this.publishTimeout(context, plan)
          throw new AnalysisDeadlineExceededError(remainingMs)
        }
        const failure = translateEvaluationFailure(error)
        await this.publishFailure({ context, plan, reason: failure.reason })
        throw failure.error
      }
      const completedAt = this.dependencies.clock.now()
      const persisted = createPersistedAnalysis({
        context,
        transcriptionResult,
        evaluation,
        rhythm,
        startedAt,
        completedAt,
        idGenerator: this.dependencies.idGenerator,
        costRates: this.dependencies.costRates,
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
    } finally {
      clearTimeout(deadlineTimer)
    }
  }

  private async publishTimeout(
    context: { readonly sessionId: string; readonly accountId: string },
    plan: AccountPlan,
  ): Promise<void> {
    await this.dependencies.eventPublisher.publish(
      AnalysisTimedOut.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt: this.dependencies.clock.now(),
        sessionId: context.sessionId,
        accountId: context.accountId,
        plan,
      }),
    )
  }

  private async publishFailure(input: {
    readonly context: { readonly sessionId: string; readonly accountId: string }
    readonly plan: AccountPlan
    readonly reason: 'transcription_failed' | 'evaluation_failed' | 'malformed_evaluation'
  }): Promise<void> {
    await this.dependencies.eventPublisher.publish(
      AnalysisFailed.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt: this.dependencies.clock.now(),
        sessionId: input.context.sessionId,
        accountId: input.context.accountId,
        plan: input.plan,
        reason: input.reason,
      }),
    )
  }
}

function translateEvaluationFailure(error: unknown): {
  readonly error: EvaluationFailedError | MalformedEvaluationError
  readonly reason: 'evaluation_failed' | 'malformed_evaluation'
} {
  if (error instanceof MalformedEvaluationError) {
    return { error, reason: 'malformed_evaluation' }
  }
  if (error instanceof EvaluationFailedError) {
    return { error, reason: 'evaluation_failed' }
  }

  return {
    error: new EvaluationFailedError('provider request failed', { cause: error }),
    reason: 'evaluation_failed',
  }
}

function calculateRhythm(words: TranscriptionResult['words']) {
  const [firstWord, ...remainingWords] = words
  if (firstWord === undefined) return null

  const lastWord = remainingWords.at(-1) ?? firstWord
  if (lastWord.end - firstWord.start <= 0) return null

  return RhythmCalculator.calculate([firstWord, ...remainingWords])
}

function createPersistedAnalysis(input: {
  readonly context: { readonly sessionId: string; readonly accountId: string }
  readonly transcriptionResult: TranscriptionResult
  readonly evaluation: EvaluationResult
  readonly rhythm: NonNullable<ReturnType<typeof calculateRhythm>>
  readonly startedAt: Date
  readonly completedAt: Date
  readonly idGenerator: IdGenerator
  readonly costRates: ProcessingCostRates
}): PersistedAnalysis {
  const cost = CostCalculator.calculate({
    durationSeconds: input.transcriptionResult.durationSeconds,
    inputTokens: input.evaluation.inputTokens,
    outputTokens: input.evaluation.outputTokens,
    ...input.costRates,
  })
  const transcription = Transcription.create({
    transcriptionId: input.idGenerator.generate(),
    sessionId: input.context.sessionId,
    text: input.transcriptionResult.text,
    words: input.transcriptionResult.words,
    durationSeconds: input.transcriptionResult.durationSeconds,
    createdAt: input.completedAt,
  })
  const analysis = Analysis.create({
    analysisId: input.idGenerator.generate(),
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
      id: input.idGenerator.generate(),
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
