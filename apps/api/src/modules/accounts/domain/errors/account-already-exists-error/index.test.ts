import { describe, expect, it } from 'vitest'

import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

import { AccountAlreadyExistsError } from './index.js'

describe('AccountAlreadyExistsError', () => {
  it('is a conflict of the domain', () => {
    const error = new AccountAlreadyExistsError(['email'])

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'accounts.ACCOUNT_ALREADY_EXISTS', httpStatus: 409 })
  })

  it('never exposes the conflicting value', () => {
    const error = new AccountAlreadyExistsError(['email'])

    expect(error.message).not.toContain('@')
    expect(error.context).toEqual({ fields: ['email'] })
  })

  it('preserves the original failure as its cause', () => {
    const cause = { code: 'P2002', constraint: 'accounts_email_key' }

    expect(new AccountAlreadyExistsError(['email'], { cause }).cause).toBe(cause)
  })
})
