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
}

export type {
  ListSessionHistoryDependencies,
  ListSessionHistoryInput,
  ListSessionHistoryOutput,
  SessionHistoryItem,
} from './types.js'
