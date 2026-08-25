import type { AccountsPort } from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { ThemesPort } from '@/modules/sessions/domain/ports/themes-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type { SessionState } from '@/modules/sessions/domain/entities/session/index.js'
import type { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

export interface ListSessionHistoryInput {
  readonly accountId: string
  readonly cursor: string | null
}

export type VisibleSessionState = Exclude<SessionState, 'deleted'>

export interface SessionHistoryItem {
  readonly sessionId: string
  readonly startedAt: string
  readonly localDate: string
  readonly localTime: string
  readonly categorySlug: string
  readonly themeTitle: string | null
  readonly difficulty: SessionConfiguration['difficulty']
  readonly totalScore: number | null
  readonly state: VisibleSessionState
  readonly bestOfDay: boolean
}

export interface ListSessionHistoryOutput {
  readonly items: readonly SessionHistoryItem[]
  readonly nextCursor: string | null
  readonly pageSize: number
  readonly timeZone: string
}

export interface ListSessionHistoryDependencies {
  readonly sessions: Pick<SessionsRepository, 'findById' | 'listByAccount' | 'findCompletedBetween'>
  readonly accounts: Pick<AccountsPort, 'findProfile'>
  readonly themes: Pick<ThemesPort, 'listThemeTitles'>
}
