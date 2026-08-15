import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'

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

  // An unusable time zone is not a rejection: the account keeps the product default
  // until the person corrects it (RF-001, bloco 1).
  static fromOptional(value: string | undefined): TimeZone {
    if (value === undefined || !isIanaTimeZone(value)) {
      return new TimeZone(DEFAULT_TIME_ZONE)
    }

    return new TimeZone(value)
  }

  equals(other: TimeZone): boolean {
    return this.value === other.value
  }
}
