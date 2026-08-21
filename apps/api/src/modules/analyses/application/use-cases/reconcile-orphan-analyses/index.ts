import type {
  ReconcileOrphanAnalysesDependencies,
  ReconcileOrphanAnalysesInput,
  ReconcileOrphanAnalysesOutput,
} from './types.js'

export class ReconcileOrphanAnalysesUseCase {
  constructor(private readonly dependencies: ReconcileOrphanAnalysesDependencies) {}

  async execute(input: ReconcileOrphanAnalysesInput): Promise<ReconcileOrphanAnalysesOutput> {
    const before = new Date(this.dependencies.clock.now().getTime() - input.staleAfterMs)
    const stuckSessionIds = await this.dependencies.sessions.listStuckProcessing(
      before,
      input.limit,
    )

    let reconciledCount = 0
    for (const sessionId of stuckSessionIds) {
      const analysis = await this.dependencies.analyses.findBySessionId(sessionId)
      if (analysis !== null) continue

      await this.dependencies.processingQueue.enqueue({ sessionId })
      reconciledCount += 1
    }

    return { reconciledCount }
  }
}

export type {
  ReconcileOrphanAnalysesDependencies,
  ReconcileOrphanAnalysesInput,
  ReconcileOrphanAnalysesOutput,
} from './types.js'
