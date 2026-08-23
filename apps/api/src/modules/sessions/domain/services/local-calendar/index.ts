import { OperationFailedError } from '@/shared/errors/operation-failed-error/index.js'

import type { LocalDateParts } from './types.js'

const dayFormatters = new Map<string, Intl.DateTimeFormat>()
const timeFormatters = new Map<string, Intl.DateTimeFormat>()

export class LocalCalendar {
  static localDayOf(at: Date, timeZone: string): string {
    const parts = dayFormatter(timeZone).formatToParts(at)

    const date: LocalDateParts = {
      year: readPart(parts, 'year', timeZone),
      month: readPart(parts, 'month', timeZone),
      day: readPart(parts, 'day', timeZone),
    }

    return `${date.year}-${date.month}-${date.day}`
  }

  static localTimeOf(at: Date, timeZone: string): string {
    const parts = timeFormatter(timeZone).formatToParts(at)

    return `${readPart(parts, 'hour', timeZone)}:${readPart(parts, 'minute', timeZone)}`
  }
}

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dayFormatters.get(timeZone)
  if (cached !== undefined) return cached

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  dayFormatters.set(timeZone, formatter)

  return formatter
}

function timeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = timeFormatters.get(timeZone)
  if (cached !== undefined) return cached

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  timeFormatters.set(timeZone, formatter)

  return formatter
}

function readPart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
  timeZone: string,
): string {
  const value = parts.find((part) => part.type === type)?.value
  if (value === undefined) {
    throw new OperationFailedError('local-calendar', { context: { part: type, timeZone } })
  }

  return value
}

export type { LocalDateParts } from './types.js'
