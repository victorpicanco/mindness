import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'
import type { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import type { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'

import type {
  AccountPlan,
  AccountStatus,
  CreateAccountParams,
  ReconstituteAccountParams,
} from './types.js'

const INITIAL_PLAN: AccountPlan = 'free'
const INITIAL_STATUS: AccountStatus = 'accessible'

function requireIdentifier(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new InvalidAccountValueError(field)
  }

  return value
}

export class Account {
  private constructor(
    readonly id: string,
    readonly email: EmailAddress,
    readonly authUserId: string,
    readonly timeZone: TimeZone,
    readonly plan: AccountPlan,
    readonly status: AccountStatus,
    readonly createdAt: Date,
  ) {}

  static create(params: CreateAccountParams): Account {
    return new Account(
      requireIdentifier(params.id, 'id'),
      params.email,
      requireIdentifier(params.authUserId, 'authUserId'),
      params.timeZone,
      INITIAL_PLAN,
      INITIAL_STATUS,
      params.createdAt,
    )
  }

  static reconstitute(params: ReconstituteAccountParams): Account {
    return new Account(
      requireIdentifier(params.id, 'id'),
      params.email,
      requireIdentifier(params.authUserId, 'authUserId'),
      params.timeZone,
      params.plan,
      params.status,
      params.createdAt,
    )
  }
}
