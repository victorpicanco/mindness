import type { LocalDateParts } from './types.js'

export class LocalCalendar {
  static localDayOf(at: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(at)
    const date = readDateParts(parts)

    return `${date.year}-${date.month}-${date.day}`
  }

  static localTimeOf(at: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at)
    let hour = ''
    let minute = ''

    for (const part of parts) {
      if (part.type === 'hour') hour = part.value
      if (part.type === 'minute') minute = part.value
    }

    return `${hour}:${minute}`
  }
}

function readDateParts(parts: Intl.DateTimeFormatPart[]): LocalDateParts {
  let year = ''
  let month = ''
  let day = ''

  for (const part of parts) {
    if (part.type === 'year') year = part.value
    if (part.type === 'month') month = part.value
    if (part.type === 'day') day = part.value
  }

  return { year, month, day }
}

export type { LocalDateParts } from './types.js'
