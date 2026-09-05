import { describe, expect, it } from 'vitest'

import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'
import { DisplayName } from '@/modules/accounts/domain/value-objects/display-name/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'

import { Account } from './index.js'

const createdAt = new Date('2026-08-15T00:00:00.000Z')

function validParams() {
  return {
    id: 'account-1',
    email: EmailAddress.create('person@example.com'),
    authUserId: 'auth-user-1',
    timeZone: TimeZone.create('America/Sao_Paulo'),
    createdAt,
  }
}

describe('Account', () => {
  it('creates an accessible free account with its authenticated identity', () => {
    const account = Account.create(validParams())

    expect(account).toMatchObject({
      id: 'account-1',
      authUserId: 'auth-user-1',
      plan: 'free',
      status: 'accessible',
      name: null,
      voiceConsent: null,
      createdAt,
    })
    expect(account.email.value).toBe('person@example.com')
    expect(account.timeZone.value).toBe('America/Sao_Paulo')
  })

  it('holds the email and the time zone as validated values, never as raw strings', () => {
    const account = Account.create(validParams())

    expect(account.email).toBeInstanceOf(EmailAddress)
    expect(account.timeZone).toBeInstanceOf(TimeZone)
  })

  it('rejects a blank id', () => {
    expect(() => Account.create({ ...validParams(), id: '   ' })).toThrow(InvalidAccountValueError)
  })

  it('rejects a blank authUserId', () => {
    expect(() => Account.create({ ...validParams(), authUserId: '   ' })).toThrow(
      InvalidAccountValueError,
    )
  })

  it('names the offending field when an identifier is blank', () => {
    expect(() => Account.create({ ...validParams(), authUserId: '' })).toThrow(
      expect.objectContaining({ context: { field: 'authUserId' } }),
    )
  })

  it('reconstitutes a persisted account with the state it was stored with', () => {
    const account = Account.reconstitute({
      ...validParams(),
      plan: 'free',
      status: 'accessible',
      name: DisplayName.create('Maria Silva'),
      voiceConsent: null,
      currentSessionId: null,
    })

    expect(account).toMatchObject({ id: 'account-1', plan: 'free', status: 'accessible' })
    expect(account.name?.value).toBe('Maria Silva')
  })

  it('rejects reconstituting an account without an identity', () => {
    expect(() =>
      Account.reconstitute({
        ...validParams(),
        id: '',
        plan: 'free',
        status: 'accessible',
        name: null,
        voiceConsent: null,
        currentSessionId: null,
      }),
    ).toThrow(InvalidAccountValueError)
  })

  it('starts without an authenticated session and keeps only the latest one', () => {
    const account = Account.create(validParams())

    expect(account.currentSessionId).toBeNull()

    account.startSession('session-1')
    expect(account.hasCurrentSession('session-1')).toBe(true)

    account.startSession('session-2')
    expect(account.hasCurrentSession('session-1')).toBe(false)
    expect(account.hasCurrentSession('session-2')).toBe(true)
  })

  it('rejects a blank session identifier', () => {
    const account = Account.create(validParams())

    expect(() => account.startSession('   ')).toThrow(
      expect.objectContaining({ context: { field: 'currentSessionId' } }),
    )
  })

  it('drops the authenticated session when the deletion is scheduled', () => {
    const account = Account.create(validParams())
    account.startSession('session-1')

    account.scheduleDeletion()

    expect(account.currentSessionId).toBeNull()
    expect(account.hasCurrentSession('session-1')).toBe(false)
  })

  it('does not allow inaccessible accounts to mutate or authenticate', () => {
    const account = Account.create(validParams())
    account.scheduleDeletion()

    expect(() => account.startSession('session-1')).toThrow(InvalidAccountValueError)
    expect(() => account.changeTimeZone(TimeZone.create('Europe/Lisbon'))).toThrow(
      InvalidAccountValueError,
    )
    expect(() => account.changeName(DisplayName.create('Maria Silva'))).toThrow(
      InvalidAccountValueError,
    )
  })

  it('starts without a name and keeps the latest one it was given', () => {
    const account = Account.create(validParams())

    expect(account.name).toBeNull()

    account.changeName(DisplayName.create('Maria Silva'))
    expect(account.name?.value).toBe('Maria Silva')

    account.changeName(DisplayName.create('Maria Souza'))
    expect(account.name?.value).toBe('Maria Souza')
  })

  it('does not expose a mutable created-at instant', () => {
    const account = Account.create(validParams())
    const exposed = account.createdAt
    exposed.setTime(0)

    expect(account.createdAt).toEqual(createdAt)
  })
})
