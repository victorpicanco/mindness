import { describe, expect, it } from 'vitest'

import { InvalidAccountValueError } from '../errors/invalid-account-value-error/index.js'
import { EmailAddress } from './email-address/index.js'
import { Password } from './password/index.js'
import { TimeZone } from './time-zone/index.js'
import { VoiceConsent } from './voice-consent/index.js'

describe('account value objects', () => {
  it('creates valid account values', () => {
    const emailFactory = Reflect.get(EmailAddress, 'create')
    const passwordFactory = Reflect.get(Password, 'create')
    const timeZoneFactory = Reflect.get(TimeZone, 'fromBrowser')
    const consentFactory = Reflect.get(VoiceConsent, 'create')

    expect(emailFactory).toBeTypeOf('function')
    expect(passwordFactory).toBeTypeOf('function')
    expect(timeZoneFactory).toBeTypeOf('function')
    expect(consentFactory).toBeTypeOf('function')

    if (
      typeof emailFactory !== 'function' ||
      typeof passwordFactory !== 'function' ||
      typeof timeZoneFactory !== 'function' ||
      typeof consentFactory !== 'function'
    ) {
      return
    }

    expect(emailFactory('person@example.com')).toMatchObject({ value: 'person@example.com' })
    expect(passwordFactory('Strong_password1!')).toMatchObject({ value: 'Strong_password1!' })
    expect(timeZoneFactory(undefined)).toMatchObject({ value: 'America/Sao_Paulo' })
    expect(
      consentFactory({
        version: '2026-08-15',
        acceptedAt: new Date('2026-08-15T00:00:00.000Z'),
      }),
    ).toMatchObject({ version: '2026-08-15' })
  })

  it('rejects invalid account values', () => {
    const emailFactory = Reflect.get(EmailAddress, 'create')
    const passwordFactory = Reflect.get(Password, 'create')
    const timeZoneFactory = Reflect.get(TimeZone, 'create')

    expect(emailFactory).toBeTypeOf('function')
    expect(passwordFactory).toBeTypeOf('function')
    expect(timeZoneFactory).toBeTypeOf('function')

    if (
      typeof emailFactory !== 'function' ||
      typeof passwordFactory !== 'function' ||
      typeof timeZoneFactory !== 'function'
    ) {
      return
    }

    expect(() => emailFactory('invalid-email')).toThrow(InvalidAccountValueError)
    expect(() => passwordFactory('short')).toThrow(InvalidAccountValueError)
    expect(() => timeZoneFactory('invalid/time-zone')).toThrow(InvalidAccountValueError)
  })
})
