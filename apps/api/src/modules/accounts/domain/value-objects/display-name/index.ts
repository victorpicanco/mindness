import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'

export const DISPLAY_NAME_MAX_LENGTH = 40

export class DisplayName {
  private constructor(readonly value: string) {}

  static create(value: string): DisplayName {
    const trimmed = value.trim()

    if (trimmed.length === 0 || trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
      throw new InvalidAccountValueError('name')
    }

    return new DisplayName(trimmed)
  }

  equals(other: DisplayName): boolean {
    return this.value === other.value
  }
}
