import { afterEach, describe, expect, it, vi } from 'vitest'

import { clientEnv, parseClientEnv } from './client'
import { EnvironmentError } from './errors'

describe('parseClientEnv', () => {
  it('accepts a fully configured browser environment', () => {
    expect(
      parseClientEnv({
        apiBaseUrl: 'https://api.mindness.test',
        supabaseUrl: 'https://project.supabase.co',
        turnstileSiteKey: '0x4AAAAAAA',
      }),
    ).toEqual({
      apiBaseUrl: 'https://api.mindness.test',
      supabaseUrl: 'https://project.supabase.co',
      turnstileSiteKey: '0x4AAAAAAA',
    })
  })

  it('treats an absent or blank value as an unconfigured optional feature', () => {
    expect(
      parseClientEnv({
        apiBaseUrl: undefined,
        supabaseUrl: 'https://project.supabase.co',
        turnstileSiteKey: '  ',
      }),
    ).toEqual({
      apiBaseUrl: undefined,
      supabaseUrl: 'https://project.supabase.co',
      turnstileSiteKey: undefined,
    })
  })

  it('rejects an API base URL that is not a URL', () => {
    expect(() =>
      parseClientEnv({
        apiBaseUrl: 'localhost:3333',
        supabaseUrl: 'https://project.supabase.co',
        turnstileSiteKey: undefined,
      }),
    ).toThrow(EnvironmentError)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([undefined, 'localhost:54321'])(
    'rejects a missing or invalid Supabase URL',
    (supabaseUrl) => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl)

      expect(clientEnv).toThrow(EnvironmentError)
      expect(clientEnv).toThrow(/NEXT_PUBLIC_SUPABASE_URL/u)
    },
  )
})
