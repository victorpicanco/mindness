import { SessionAuthenticationRejectedError } from '@/modules/sessions/domain/errors/session-authentication-rejected-error/index.js'
import { BestOfDayResolver } from '@/modules/sessions/domain/services/best-of-day-resolver/index.js'
import { LocalCalendar } from '@/modules/sessions/domain/services/local-calendar/index.js'

import { InvalidHistoryCursorError } from './errors.js'
import type {
  ListSessionHistoryDependencies,
  ListSessionHistoryInput,
  ListSessionHistoryOutput,
  SessionHistoryItem,
} from './types.js'

const HISTORY_PAGE_SIZE = 20
const DAY_LOOKUP_MARGIN_MS = 26 * 60 * 60 * 1000

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

    const candidates = await this.dependencies.sessions.findCompletedBetween(
      input.accountId,
      new Date(oldest.createdAt.getTime() - DAY_LOOKUP_MARGIN_MS),
      new Date(newest.createdAt.getTime() + DAY_LOOKUP_MARGIN_MS),
    )
    const bestIds = BestOfDayResolver.resolve(
      candidates.flatMap((session) => {
        const totalScore = session.totalScore
        return totalScore === null
          ? []
          : [{ sessionId: session.id, totalScore, createdAt: session.createdAt }]
      }),
      profile.timeZone,
    )

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
          totalScore: session.totalScore,
          state,
          bestOfDay: bestIds.has(session.id),
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
