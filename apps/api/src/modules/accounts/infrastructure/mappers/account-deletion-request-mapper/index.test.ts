import { describe, expect, it } from 'vitest'

import { AccountDeletionRequest } from '@/modules/accounts/domain/entities/account-deletion-request/index.js'

import { AccountDeletionRequestMapper } from './index.js'

describe('AccountDeletionRequestMapper', () => {
  it('maps the complete deletion schedule to persistence', () => {
    const request = AccountDeletionRequest.create({
      id: 'request-1',
      accountId: 'account-1',
      requestedAt: new Date('2026-08-15T12:00:00.000Z'),
      scheduledFor: new Date('2026-09-14T12:00:00.000Z'),
    })

    expect(new AccountDeletionRequestMapper().toPersistence(request)).toEqual({
      id: 'request-1',
      accountId: 'account-1',
      requestedAt: new Date('2026-08-15T12:00:00.000Z'),
      scheduledFor: new Date('2026-09-14T12:00:00.000Z'),
    })
  })
})
