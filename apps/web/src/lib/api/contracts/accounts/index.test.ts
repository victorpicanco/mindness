import { describe, expect, it } from 'vitest'

import { accountProfileSchema } from './index'

const profile = {
  accountId: '4ff569a3-bffc-4b5d-bbb2-662ebf994a85',
  authenticationMethod: 'password',
  consent: {
    acceptedAt: '2026-08-15T12:00:00.000Z',
    purpose: 'voice_recording_and_analysis',
    version: '2026-08-15',
  },
  createdAt: '2026-08-01T10:30:00.000Z',
  email: 'person@example.com',
  name: 'Maria Silva',
  plan: 'free',
  timeZone: 'America/Sao_Paulo',
}

describe('accountProfileSchema', () => {
  it('validates every account profile field exposed by the API', () => {
    expect(accountProfileSchema.parse(profile)).toEqual(profile)
  })

  it('accepts an account that was never named', () => {
    expect(accountProfileSchema.parse({ ...profile, name: null }).name).toBeNull()
  })

  it('rejects unknown fields and invalid account values', () => {
    expect(() =>
      accountProfileSchema.parse({ ...profile, authenticationMethod: 'magic-link' }),
    ).toThrow()
    expect(() =>
      accountProfileSchema.parse({ ...profile, authUserId: 'private-provider-id' }),
    ).toThrow()
  })
})
