import { describe, expect, it } from 'vitest'

import { BaseError } from '@/shared/errors/base-error/index.js'

import { InvalidQuotaTransitionError } from '@/modules/quota/domain/errors/invalid-quota-transition-error/index.js'
import { InvalidQuotaValueError } from '@/modules/quota/domain/errors/invalid-quota-value-error/index.js'
import { QuotaAccountNotFoundError } from '@/modules/quota/domain/errors/quota-account-not-found-error/index.js'
import { QuotaCycleAlreadyOpenError } from '@/modules/quota/domain/errors/quota-cycle-already-open-error/index.js'
import { QuotaReservationNotFoundError } from '@/modules/quota/domain/errors/quota-reservation-not-found-error/index.js'

import { QuotaExhaustedError } from './index.js'

const RENEWS_AT = new Date('2026-09-16T12:00:00.000Z')
const STARTS_AT = new Date('2026-08-17T12:00:00.000Z')

describe('quota domain errors', () => {
  it.each([
    [
      new QuotaExhaustedError('account-1', RENEWS_AT),
      'quota.QUOTA_EXHAUSTED',
      409,
      { accountId: 'account-1', renewsAt: RENEWS_AT.toISOString() },
    ],
    [
      new InvalidQuotaTransitionError('held', 'held'),
      'quota.INVALID_QUOTA_TRANSITION',
      409,
      { currentStatus: 'held', targetStatus: 'held' },
    ],
    [
      new InvalidQuotaValueError('allowance'),
      'quota.INVALID_QUOTA_VALUE',
      422,
      { field: 'allowance' },
    ],
    [
      new QuotaReservationNotFoundError('session-1'),
      'quota.QUOTA_RESERVATION_NOT_FOUND',
      404,
      { sessionId: 'session-1' },
    ],
    [
      new QuotaAccountNotFoundError('account-1'),
      'quota.QUOTA_ACCOUNT_NOT_FOUND',
      404,
      { accountId: 'account-1' },
    ],
    [
      new QuotaCycleAlreadyOpenError('account-1', STARTS_AT),
      'quota.QUOTA_CYCLE_ALREADY_OPEN',
      409,
      { accountId: 'account-1', startsAt: STARTS_AT.toISOString() },
    ],
  ])('has the expected code, HTTP status, and context', (error, code, httpStatus, context) => {
    expect(error).toBeInstanceOf(BaseError)
    expect(error.code).toBe(code)
    expect(error.httpStatus).toBe(httpStatus)
    expect(error.context).toEqual(context)
  })
})
