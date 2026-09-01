import {
  CommunicationAnalysis,
  SPEECH_FEEDBACK_PROMPT_VERSION,
} from '@/modules/analyses/domain/entities/communication-analysis/index.js'
import { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import { AnalysisCompleted } from '@/modules/analyses/domain/events/analysis-completed/index.js'
import { AnalysisTimedOut } from '@/modules/analyses/domain/events/analysis-timed-out/index.js'
import { AnalysisDeadlineExceededError } from '@/modules/analyses/domain/errors/analysis-deadline-exceeded-error/index.js'
import { FeedbackSynthesisFailedError } from '@/modules/analyses/domain/errors/feedback-synthesis-failed-error/index.js'
import { TranscriptionFailedError } from '@/modules/analyses/domain/errors/transcription-failed-error/index.js'
import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { AuditoryAnalysisResult } from '@/modules/analyses/domain/ports/auditory-analysis-port/index.js'
import type { FeedbackSynthesisResult } from '@/modules/analyses/domain/ports/feedback-synthesis-port/index.js'
import type { IdGenerator } from '@/modules/analyses/domain/ports/id-generator/index.js'
import type { TranscriptionResult } from '@/modules/analyses/domain/ports/transcription-port/index.js'
import { CostCalculator } from '@/modules/analyses/domain/services/cost-calculator/index.js'
import { RhythmCalculator } from '@/modules/analyses/domain/services/rhythm-calculator/index.js'

import type {
  MultimodalProcessingCostRates,
  PersistedCommunicationAnalysis,
  ProcessMultimodalSessionAudioDependencies,
  ProcessMultimodalSessionAudioInput,
  ProcessMultimodalSessionAudioOutput,
} from './types.js'

const ANALYSIS_DEADLINE_MS = 300_000

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
    const controller = new AbortController()
    const deadlineTimer = setTimeout(() => controller.abort(), remainingMs)
    try {
      const source = await this.dependencies.audioReader.read(context.sessionId)
      const audio = await this.dependencies.audioPreparation.prepare({
        source,
        signal: controller.signal,
      })

      const [observationResult, transcriptionResult] = await Promise.all([
        this.dependencies.auditoryAnalysis.observe({ audio, signal: controller.signal }),
        this.dependencies.transcription.transcribe({
          audio: source.bytes,
          deadlineMs: remainingMs,
          signal: controller.signal,
        }),
      ])

      const rhythm = calculateRhythm(transcriptionResult.words)
      if (rhythm === null) throw new TranscriptionFailedError('transcription has no words')

      const themeTitle = await this.dependencies.themes.findTitle(context.themeId)
      if (themeTitle === null) throw new FeedbackSynthesisFailedError('theme not found')

      const synthesis = await this.dependencies.feedbackSynthesis.synthesize({
        audio,
        observation: observationResult.observation,
        themeTitle,
        transcript: transcriptionResult.text,
        words: transcriptionResult.words,
        rhythm: rhythm.metrics,
        signal: controller.signal,
      })

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
