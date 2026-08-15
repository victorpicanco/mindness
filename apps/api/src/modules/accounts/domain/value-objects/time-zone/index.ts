import { InvalidAccountValueError } from '../../errors/invalid-account-value-error/index.js'

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'

function isIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

export class TimeZone {
  private constructor(readonly value: string) {}

  static create(value: string): TimeZone {
    if (!isIanaTimeZone(value)) {
      throw new InvalidAccountValueError('timeZone')
    }

    return new TimeZone(value)
  }

  static fromBrowser(value: string | undefined): TimeZone {
    if (value === undefined || !isIanaTimeZone(value)) {
      return new TimeZone(DEFAULT_TIME_ZONE)
    }

    return new TimeZone(value)
  }
}
