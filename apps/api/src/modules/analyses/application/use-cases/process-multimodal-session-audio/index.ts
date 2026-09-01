import {
  CommunicationAnalysis,
  SPEECH_FEEDBACK_PROMPT_VERSION,
} from '@/modules/analyses/domain/entities/communication-analysis/index.js'
import { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import { AnalysisCompleted } from '@/modules/analyses/domain/events/analysis-completed/index.js'
import { AnalysisFailed } from '@/modules/analyses/domain/events/analysis-failed/index.js'
import type { AnalysisFailureReason } from '@/modules/analyses/domain/events/analysis-failed/index.js'
import { AnalysisTimedOut } from '@/modules/analyses/domain/events/analysis-timed-out/index.js'
import { AnalysisDeadlineExceededError } from '@/modules/analyses/domain/errors/analysis-deadline-exceeded-error/index.js'
import { AudioPreparationFailedError } from '@/modules/analyses/domain/errors/audio-preparation-failed-error/index.js'
import { AuditoryAnalysisFailedError } from '@/modules/analyses/domain/errors/auditory-analysis-failed-error/index.js'
import { FeedbackSynthesisFailedError } from '@/modules/analyses/domain/errors/feedback-synthesis-failed-error/index.js'
import { MalformedAuditoryAnalysisError } from '@/modules/analyses/domain/errors/malformed-auditory-analysis-error/index.js'
import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import { TranscriptionFailedError } from '@/modules/analyses/domain/errors/transcription-failed-error/index.js'
import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { PreparedAudio } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import type { AudioContent } from '@/modules/analyses/domain/ports/audio-reader-port/index.js'
import type { AuditoryAnalysisResult } from '@/modules/analyses/domain/ports/auditory-analysis-port/index.js'
import type { FeedbackSynthesisResult } from '@/modules/analyses/domain/ports/feedback-synthesis-port/index.js'
import type { IdGenerator } from '@/modules/analyses/domain/ports/id-generator/index.js'
import type { TranscriptionResult } from '@/modules/analyses/domain/ports/transcription-port/index.js'
import { CostCalculator } from '@/modules/analyses/domain/services/cost-calculator/index.js'
import { RhythmCalculator } from '@/modules/analyses/domain/services/rhythm-calculator/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'

import type {
  MultimodalProcessingCostRates,
  PersistedCommunicationAnalysis,
  ProcessMultimodalSessionAudioDependencies,
  ProcessMultimodalSessionAudioInput,
  ProcessMultimodalSessionAudioOutput,
} from './types.js'

const ANALYSIS_DEADLINE_MS = 300_000

interface ClassifiedFailure {
  readonly error: BaseError
  readonly reason: AnalysisFailureReason
}

interface BranchFailure extends ClassifiedFailure {
  readonly deadlineReached: boolean
}

export class ProcessMultimodalSessionAudioUseCase {
  constructor(private readonly dependencies: ProcessMultimodalSessionAudioDependencies) {}

  async execute(
    input: ProcessMultimodalSessionAudioInput,
  ): Promise<ProcessMultimodalSessionAudioOutput> {
    const existingAnalysis = await this.dependencies.communicationAnalyses.findBySessionId(
      input.sessionId,
    )
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
    const deadline = new AbortController()
    const deadlineTimer = setTimeout(() => deadline.abort(), remainingMs)
    const abort = async (failure: BranchFailure): Promise<never> => {
      if (failure.deadlineReached) {
        await this.publishTimeout(context, plan)
        throw new AnalysisDeadlineExceededError(remainingMs)
      }
      await this.publishFailure({ context, plan, reason: failure.reason })
      throw failure.error
    }

    try {
      let source: AudioContent
      let audio: PreparedAudio
      try {
        source = await this.dependencies.audioReader.read(context.sessionId)
        audio = await this.dependencies.audioPreparation.prepare({
          source,
          signal: deadline.signal,
        })
      } catch (error) {
        return await abort({
          ...translatePreparationFailure(error),
          deadlineReached: deadline.signal.aborted,
        })
      }

      const auditoryController = linkToDeadline(deadline.signal)
      const transcriptionController = linkToDeadline(deadline.signal)
      let firstFailure: BranchFailure | null = null
      const recordFailure = (failure: ClassifiedFailure): void => {
        firstFailure ??= { ...failure, deadlineReached: deadline.signal.aborted }
      }

      const auditoryPromise = this.dependencies.auditoryAnalysis.observe({
        audio,
        signal: auditoryController.signal,
      })
      const transcriptionPromise = this.dependencies.transcription.transcribe({
        audio: source.bytes,
        deadlineMs: remainingMs,
        signal: transcriptionController.signal,
      })
      auditoryPromise.catch((error: unknown) => {
        recordFailure(translateAuditoryFailure(error))
        transcriptionController.abort()
      })
      transcriptionPromise.catch((error: unknown) => {
        recordFailure(translateTranscriptionFailure(error))
        auditoryController.abort()
      })

      const [auditorySettled, transcriptionSettled] = await Promise.allSettled([
        auditoryPromise,
        transcriptionPromise,
      ])
      if (firstFailure !== null) return await abort(firstFailure)
      if (auditorySettled.status !== 'fulfilled' || transcriptionSettled.status !== 'fulfilled') {
        return await abort({
          error: new AuditoryAnalysisFailedError('parallel stage did not settle'),
          reason: 'auditory_analysis_failed',
          deadlineReached: deadline.signal.aborted,
        })
      }

      const observationResult = auditorySettled.value
      const transcriptionResult = transcriptionSettled.value
      if (observationResult.observation.audioUsability === 'unusable') {
        return await abort({
          error: new AuditoryAnalysisFailedError('audio is unusable'),
          reason: 'unusable_audio',
          deadlineReached: false,
        })
      }

      const rhythm = calculateRhythm(transcriptionResult.words)
      if (rhythm === null) {
        return await abort({
          error: new TranscriptionFailedError('transcription has no words'),
          reason: 'transcription_failed',
          deadlineReached: false,
        })
      }

      const themeTitle = await this.dependencies.themes.findTitle(context.themeId)
      if (themeTitle === null) {
        return await abort({
          error: new FeedbackSynthesisFailedError('theme not found'),
          reason: 'feedback_synthesis_failed',
          deadlineReached: false,
        })
      }

      let synthesis: FeedbackSynthesisResult
      try {
        synthesis = await this.dependencies.feedbackSynthesis.synthesize({
          audio,
          observation: observationResult.observation,
          themeTitle,
          transcript: transcriptionResult.text,
          words: transcriptionResult.words,
          rhythm: rhythm.metrics,
          signal: deadline.signal,
        })
      } catch (error) {
        return await abort({
          ...translateSynthesisFailure(error),
          deadlineReached: deadline.signal.aborted,
        })
      }

      const completedAt = this.dependencies.clock.now()
      const persisted = createPersistedCommunicationAnalysis({
        context,
        transcriptionResult,
        observationResult,
        synthesis,
        startedAt,
        completedAt,
        idGenerator: this.dependencies.idGenerator,
        costRates: this.dependencies.costRates,
      })

      await this.dependencies.unitOfWork.run(async () => {
        await this.dependencies.transcriptions.save(persisted.transcription)
        await this.dependencies.communicationAnalyses.save(persisted.analysis)
        await this.dependencies.costs.save(persisted.costEntry)
      })
      await this.dependencies.eventPublisher.publish(
        AnalysisCompleted.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: completedAt,
          sessionId: context.sessionId,
          accountId: context.accountId,
          plan,
          analysisVersion: 2,
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
    readonly reason: AnalysisFailureReason
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

function linkToDeadline(deadline: AbortSignal): AbortController {
  const controller = new AbortController()
  if (deadline.aborted) {
    controller.abort()
    return controller
  }
  deadline.addEventListener('abort', () => controller.abort(), { once: true })

  return controller
}

function translatePreparationFailure(error: unknown): ClassifiedFailure {
  if (error instanceof AudioPreparationFailedError) {
    return { error, reason: 'audio_preparation_failed' }
  }

  return {
    error: new AudioPreparationFailedError('audio could not be prepared', { cause: error }),
    reason: 'audio_preparation_failed',
  }
}

function translateAuditoryFailure(error: unknown): ClassifiedFailure {
  if (error instanceof MalformedAuditoryAnalysisError) {
    return { error, reason: 'malformed_evaluation' }
  }
  if (error instanceof AuditoryAnalysisFailedError) {
    return { error, reason: 'auditory_analysis_failed' }
  }

  return {
    error: new AuditoryAnalysisFailedError('provider request failed', { cause: error }),
    reason: 'auditory_analysis_failed',
  }
}

function translateTranscriptionFailure(error: unknown): ClassifiedFailure {
  if (error instanceof TranscriptionFailedError) {
    return { error, reason: 'transcription_failed' }
  }

  return {
    error: new TranscriptionFailedError('provider request failed', { cause: error }),
    reason: 'transcription_failed',
  }
}

function translateSynthesisFailure(error: unknown): ClassifiedFailure {
  if (error instanceof MalformedEvaluationError) {
    return { error, reason: 'malformed_evaluation' }
  }
  if (error instanceof FeedbackSynthesisFailedError) {
    return { error, reason: 'feedback_synthesis_failed' }
  }

  return {
    error: new FeedbackSynthesisFailedError('provider request failed', { cause: error }),
    reason: 'feedback_synthesis_failed',
  }
}

function calculateRhythm(words: TranscriptionResult['words']) {
  const [firstWord, ...remainingWords] = words
  if (firstWord === undefined) return null

  const lastWord = remainingWords.at(-1) ?? firstWord
  if (lastWord.end - firstWord.start <= 0) return null

  return RhythmCalculator.calculate([firstWord, ...remainingWords])
}

function createPersistedCommunicationAnalysis(input: {
  readonly context: { readonly sessionId: string; readonly accountId: string }
  readonly transcriptionResult: TranscriptionResult
  readonly observationResult: AuditoryAnalysisResult
  readonly synthesis: FeedbackSynthesisResult
  readonly startedAt: Date
  readonly completedAt: Date
  readonly idGenerator: IdGenerator
  readonly costRates: MultimodalProcessingCostRates
}): PersistedCommunicationAnalysis {
  const cost = CostCalculator.calculateMultimodal({
    durationSeconds: input.transcriptionResult.durationSeconds,
    auditory: {
      inputTokens: input.observationResult.inputTokens,
      outputTokens: input.observationResult.outputTokens,
    },
    synthesis: {
      inputTokens: input.synthesis.inputTokens,
      outputTokens: input.synthesis.outputTokens,
    },
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
  const analysis = CommunicationAnalysis.create({
    analysisId: input.idGenerator.generate(),
    sessionId: input.context.sessionId,
    promptVersion: SPEECH_FEEDBACK_PROMPT_VERSION,
    feedback: input.synthesis.feedback,
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
      auditoryMicrosUsd: cost.auditoryMicrosUsd,
      synthesisMicrosUsd: cost.synthesisMicrosUsd,
      totalMicrosUsd: cost.totalMicrosUsd,
      incurredAt: input.completedAt,
    },
  }
}

export type {
  ProcessMultimodalSessionAudioDependencies,
  ProcessMultimodalSessionAudioInput,
  ProcessMultimodalSessionAudioOutput,
} from './types.js'
