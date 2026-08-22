import type { AccountsPort } from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type { SessionState } from '@/modules/sessions/domain/entities/session/index.js'
import type { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

export interface ListSessionHistoryInput {
  readonly accountId: string
  readonly cursor: string | null
}

export interface SessionHistoryItem {
  readonly sessionId: string
  readonly startedAt: string
  readonly localDate: string
  readonly localTime: string
  readonly categorySlug: string
  readonly difficulty: SessionConfiguration['difficulty']
  readonly totalScore: number | null
  readonly state: SessionState
  readonly bestOfDay: boolean
}

export interface ListSessionHistoryOutput {
  readonly items: readonly SessionHistoryItem[]
  readonly nextCursor: string | null
}

export interface ListSessionHistoryDependencies {
  readonly sessions: Pick<SessionsRepository, 'findById' | 'listByAccount' | 'findCompletedBetween'>
  readonly accounts: Pick<AccountsPort, 'findProfile'>
}
