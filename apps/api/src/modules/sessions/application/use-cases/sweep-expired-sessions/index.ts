import type {
  SweepExpiredSessionsDependencies,
  SweepExpiredSessionsInput,
  SweepExpiredSessionsOutput,
} from './types.js'

export class SweepExpiredSessionsUseCase {
  constructor(private readonly dependencies: SweepExpiredSessionsDependencies) {}

  async execute(input: SweepExpiredSessionsInput = {}): Promise<SweepExpiredSessionsOutput> {
    const sessions = await this.dependencies.sessions.findExpiredInProgress(
      this.dependencies.clock.now(),
      input.limit ?? this.dependencies.defaultLimit,
    )

    for (const session of sessions) {
      await this.dependencies.expireSession.execute({
        accountId: session.accountId,
        sessionId: session.id,
        reason: 'timeout',
      })
    }

    return { expiredCount: sessions.length }
  }
}

export type {
  SweepExpiredSessionsDependencies,
  SweepExpiredSessionsInput,
  SweepExpiredSessionsOutput,
} from './types.js'
