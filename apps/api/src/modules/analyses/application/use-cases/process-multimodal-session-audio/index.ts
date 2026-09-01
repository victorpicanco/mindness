import { AnalysisTimedOut } from '@/modules/analyses/domain/events/analysis-timed-out/index.js'
import { AnalysisDeadlineExceededError } from '@/modules/analyses/domain/errors/analysis-deadline-exceeded-error/index.js'
import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'

import type {
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

    const controller = new AbortController()
    const deadlineTimer = setTimeout(() => controller.abort(), remainingMs)
    try {
      const source = await this.dependencies.audioReader.read(context.sessionId)
      const audio = await this.dependencies.audioPreparation.prepare({
        source,
        signal: controller.signal,
      })

      await Promise.all([
        this.dependencies.auditoryAnalysis.observe({ audio, signal: controller.signal }),
        this.dependencies.transcription.transcribe({
          audio: source.bytes,
          deadlineMs: remainingMs,
          signal: controller.signal,
        }),
      ])
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

export type {
  ProcessMultimodalSessionAudioDependencies,
  ProcessMultimodalSessionAudioInput,
  ProcessMultimodalSessionAudioOutput,
} from './types.js'
