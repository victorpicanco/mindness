import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,64}$/

export class Password {
  private constructor(readonly value: string) {}

  static create(value: string): Password {
    if (!PASSWORD_PATTERN.test(value)) {
      throw new InvalidAccountValueError('password')
    }

    return new Password(value)
  }

  equals(other: Password): boolean {
    return this.value === other.value
  }
}
