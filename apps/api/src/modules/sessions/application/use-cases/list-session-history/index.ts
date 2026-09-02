import { SessionAuthenticationRejectedError } from '@/modules/sessions/domain/errors/session-authentication-rejected-error/index.js'
import { LocalCalendar } from '@/modules/sessions/domain/services/local-calendar/index.js'

import { InvalidHistoryCursorError } from './errors.js'
import type {
  ListSessionHistoryDependencies,
  ListSessionHistoryInput,
  ListSessionHistoryOutput,
  SessionHistoryItem,
} from './types.js'

const HISTORY_PAGE_SIZE = 20
export class ListSessionHistoryUseCase {
  constructor(private readonly dependencies: ListSessionHistoryDependencies) {}

  async execute(input: ListSessionHistoryInput): Promise<ListSessionHistoryOutput> {
    const profile = await this.dependencies.accounts.findProfile(input.accountId)
    if (profile === null) throw new SessionAuthenticationRejectedError()

    if (input.cursor !== null) {
      const cursorSession = await this.dependencies.sessions.findById(input.cursor)
      if (cursorSession === null || cursorSession.accountId !== input.accountId) {
        throw new InvalidHistoryCursorError()
      }
    }

    const page = await this.dependencies.sessions.listByAccount({
      accountId: input.accountId,
      limit: HISTORY_PAGE_SIZE + 1,
      cursor: input.cursor,
    })
    const hasNext = page.length > HISTORY_PAGE_SIZE
    const items = page.slice(0, HISTORY_PAGE_SIZE)
    const oldest = items.at(-1)
    const newest = items[0]

    if (oldest === undefined || newest === undefined) {
      return {
        items: [],
        nextCursor: null,
        pageSize: HISTORY_PAGE_SIZE,
        timeZone: profile.timeZone,
      }
    }

    const themeTitles = await this.readThemeTitles(
      items.flatMap((session) => (session.state === 'deleted' ? [] : [session.themeId])),
    )

    const historyItems: readonly SessionHistoryItem[] = items.flatMap((session) => {
      const state = session.state
      if (state === 'deleted') return []

      return [
        {
          sessionId: session.id,
          startedAt: session.createdAt.toISOString(),
          localDate: LocalCalendar.localDayOf(session.createdAt, profile.timeZone),
          localTime: LocalCalendar.localTimeOf(session.createdAt, profile.timeZone),
          categorySlug: session.configuration.categorySlug,
          themeTitle: themeTitles.get(session.themeId) ?? null,
          difficulty: session.configuration.difficulty,
          state,
        },
      ]
    })

    return {
      items: historyItems,
      nextCursor: hasNext ? oldest.id : null,
      pageSize: HISTORY_PAGE_SIZE,
      timeZone: profile.timeZone,
    }
  }

  private async readThemeTitles(themeIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const distinctIds = [...new Set(themeIds)]
    if (distinctIds.length === 0) return new Map()

    const titles = await this.dependencies.themes.listThemeTitles(distinctIds)

    return new Map(titles.map((theme) => [theme.themeId, theme.title]))
  }
}

export type {
  ListSessionHistoryDependencies,
  ListSessionHistoryInput,
  ListSessionHistoryOutput,
  SessionHistoryItem,
} from './types.js'
