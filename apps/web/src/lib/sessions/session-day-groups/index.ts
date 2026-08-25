import type { SessionHistoryItem } from '@/lib/api/contracts/sessions'
import { sessionPath } from '@/lib/navigation/session-routes'

import type { SessionDayGroup, SessionDayHeading, SessionGroupItem } from './types'

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

interface GroupSessionsByDayInput {
  readonly now: Date
  readonly sessions: readonly SessionHistoryItem[]
  readonly timeZone: string
}

export function groupSessionsByDay({
  now,
  sessions,
  timeZone,
}: GroupSessionsByDayInput): readonly SessionDayGroup[] {
  const startOfToday = startOfLocalDay(now, timeZone)
  const today = toIsoDate(startOfToday)
  const yesterday = toIsoDate(new Date(startOfToday.getTime() - DAY_IN_MILLISECONDS))
  const itemsByDay = new Map<string, SessionGroupItem[]>()

  for (const session of sessions) {
    const items = itemsByDay.get(session.localDate) ?? []

    items.push({
      sessionId: session.sessionId,
      href: sessionPath(session.sessionId),
      title: session.themeTitle,
    })
    itemsByDay.set(session.localDate, items)
  }

  return [...itemsByDay].map(([localDate, items]) => ({
    localDate,
    heading: headingOf(localDate, today, yesterday),
    items,
  }))
}

function headingOf(localDate: string, today: string, yesterday: string): SessionDayHeading {
  if (localDate === today) return { kind: 'today' }
  if (localDate === yesterday) return { kind: 'yesterday' }

  return { kind: 'date', value: toDayFirstDate(localDate) }
}

function startOfLocalDay(at: Date, timeZone: string): Date {
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)

  return new Date(`${localDate}T00:00:00.000Z`)
}

function toIsoDate(at: Date): string {
  return at.toISOString().slice(0, 10)
}

function toDayFirstDate(localDate: string): string {
  const [year, month, day] = localDate.split('-')
  if (year === undefined || month === undefined || day === undefined) return localDate

  return `${day}/${month}/${year}`
}

export type { SessionDayGroup, SessionDayHeading, SessionGroupItem } from './types'
