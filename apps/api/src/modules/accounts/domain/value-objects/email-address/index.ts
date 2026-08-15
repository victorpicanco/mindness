import { InvalidAccountValueError } from '../../errors/invalid-account-value-error/index.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class EmailAddress {
  private constructor(readonly value: string) {}

  static create(value: string): EmailAddress {
    if (value.length > 254 || !EMAIL_PATTERN.test(value)) {
      throw new InvalidAccountValueError('email')
    }

    return new EmailAddress(value.toLowerCase())
  }
}
