import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

export interface ExpireSession {
  execute(input: {
    readonly accountId: string
    readonly sessionId: string
    readonly reason: 'timeout'
  }): Promise<void>
}

export interface SweepExpiredSessionsInput {
  readonly limit?: number
}

export interface SweepExpiredSessionsOutput {
  readonly expiredCount: number
}

export interface SweepExpiredSessionsDependencies {
  readonly sessions: SessionsRepository
  readonly expireSession: ExpireSession
  readonly clock: Clock
  readonly defaultLimit: number
}
