import type { SessionExpiredReason } from '@/modules/sessions/domain/entities/session/index.js'
import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type {
  SearchWindowMinutes,
  SessionDifficulty,
} from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

export interface GetActiveSessionInput {
  readonly accountId: string
}

export interface GetActiveSessionOutput {
  readonly sessionId: string
  readonly themeId: string
  readonly configuration: {
    readonly difficulty: SessionDifficulty
    readonly categorySlug: string
    readonly searchWindowMinutes: SearchWindowMinutes
  }
  readonly createdAt: string
  readonly expiresAt: string
}

export interface ExpireActiveSession {
  execute(input: {
    readonly accountId: string
    readonly sessionId: string
    readonly reason: SessionExpiredReason
  }): Promise<void>
}

export interface GetActiveSessionDependencies {
  readonly sessions: SessionsRepository
  readonly clock: Clock
  readonly expireSession: ExpireActiveSession
}
