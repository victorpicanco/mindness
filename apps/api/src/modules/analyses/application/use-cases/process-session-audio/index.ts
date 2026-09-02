import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import { AnalysisCompleted } from '@/modules/analyses/domain/events/analysis-completed/index.js'
import { AnalysisFailed } from '@/modules/analyses/domain/events/analysis-failed/index.js'
import type { AnalysisFailureReason } from '@/modules/analyses/domain/events/analysis-failed/index.js'
import { AnalysisTimedOut } from '@/modules/analyses/domain/events/analysis-timed-out/index.js'
import { AnalysisDeadlineExceededError } from '@/modules/analyses/domain/errors/analysis-deadline-exceeded-error/index.js'
import { AudioPreparationFailedError } from '@/modules/analyses/domain/errors/audio-preparation-failed-error/index.js'
import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'
import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import { TranscriptionFailedError } from '@/modules/analyses/domain/errors/transcription-failed-error/index.js'
import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { EvaluationResult } from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import type { IdGenerator } from '@/modules/analyses/domain/ports/id-generator/index.js'
import type { TranscriptionResult } from '@/modules/analyses/domain/ports/transcription-port/index.js'
import { CostCalculator } from '@/modules/analyses/domain/services/cost-calculator/index.js'

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
    if ((await this.dependencies.analyses.findBySessionId(input.sessionId)) !== null) return

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
    if (remainingMs <= 0) return await this.timeout(context, plan, remainingMs)

    const startedAt = this.dependencies.clock.now()
    const controller = new AbortController()
    const deadlineTimer = setTimeout(() => controller.abort(), remainingMs)
    try {
      const source = await this.run(
        () => this.dependencies.audioReader.read(context.sessionId),
        'transcription_failed',
        context,
        plan,
        controller,
        remainingMs,
        (cause) => new TranscriptionFailedError('audio read failed', { cause }),
      )
      const transcriptionResult = await this.run(
        () =>
          this.dependencies.transcription.transcribe({
            audio: source.bytes,
            deadlineMs: remainingMs,
            signal: controller.signal,
          }),
        'transcription_failed',
        context,
        plan,
        controller,
        remainingMs,
        (cause) => new TranscriptionFailedError('provider request failed', { cause }),
      )
      const audio = await this.run(
        () => this.dependencies.audioPreparation.prepare({ source, signal: controller.signal }),
        'audio_preparation_failed',
        context,
        plan,
        controller,
        remainingMs,
        (cause) => new AudioPreparationFailedError('audio preparation failed', { cause }),
      )

      const themeTitle = await this.dependencies.themes.findTitle(context.themeId)
      if (themeTitle === null) {
        const error = new EvaluationFailedError('theme not found')
        await this.publishFailure(context, plan, 'evaluation_failed')
        throw error
      }

      const evaluation = await this.run(
        () =>
          this.dependencies.evaluation.evaluate({
            audio,
            themeTitle,
            transcript: transcriptionResult.text,
            words: transcriptionResult.words,
            signal: controller.signal,
          }),
        'evaluation_failed',
        context,
        plan,
        controller,
        remainingMs,
        translateEvaluationFailure,
      )
      const completedAt = this.dependencies.clock.now()
      const persisted = createPersistedAnalysis({
        context,
        transcriptionResult,
        evaluation,
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
          processingMs: persisted.analysis.processingMs,
          costMicrosUsd: persisted.analysis.costMicrosUsd,
        }),
      )
    } finally {
      clearTimeout(deadlineTimer)
    }
  }

  private async run<T>(
    operation: () => Promise<T>,
    reason: AnalysisFailureReason,
    context: { readonly sessionId: string; readonly accountId: string },
    plan: AccountPlan,
    controller: AbortController,
    remainingMs: number,
    translate: (
      cause: unknown,
    ) =>
      | AudioPreparationFailedError
      | EvaluationFailedError
      | MalformedEvaluationError
      | TranscriptionFailedError,
  ): Promise<T> {
    try {
      return await operation()
    } catch (cause) {
      if (controller.signal.aborted) return await this.timeout(context, plan, remainingMs)
      const error = translate(cause)
      const failureReason =
        error instanceof MalformedEvaluationError ? 'malformed_evaluation' : reason
      await this.publishFailure(context, plan, failureReason)
      throw error
    }
  }

  private async timeout(
    context: { readonly sessionId: string; readonly accountId: string },
    plan: AccountPlan,
    remainingMs: number,
  ): Promise<never> {
    await this.dependencies.eventPublisher.publish(
      AnalysisTimedOut.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt: this.dependencies.clock.now(),
        sessionId: context.sessionId,
        accountId: context.accountId,
        plan,
      }),
    )
    throw new AnalysisDeadlineExceededError(remainingMs)
  }

  private async publishFailure(
    context: { readonly sessionId: string; readonly accountId: string },
    plan: AccountPlan,
    reason: AnalysisFailureReason,
  ): Promise<void> {
    await this.dependencies.eventPublisher.publish(
      AnalysisFailed.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt: this.dependencies.clock.now(),
        sessionId: context.sessionId,
        accountId: context.accountId,
        plan,
        reason,
      }),
    )
  }
}

function translateEvaluationFailure(
  cause: unknown,
): EvaluationFailedError | MalformedEvaluationError {
  if (cause instanceof MalformedEvaluationError || cause instanceof EvaluationFailedError)
    return cause
  return new EvaluationFailedError('provider request failed', { cause })
}

function createPersistedAnalysis(input: {
  readonly context: { readonly sessionId: string; readonly accountId: string }
  readonly transcriptionResult: TranscriptionResult
  readonly evaluation: EvaluationResult
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
    feedback: input.evaluation.feedback,
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
