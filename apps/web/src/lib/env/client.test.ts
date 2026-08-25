import { describe, expect, it } from 'vitest'

import { parseClientEnv } from './client'
import { EnvironmentError } from './errors'

describe('parseClientEnv', () => {
  it('accepts a fully configured browser environment', () => {
    expect(
      parseClientEnv({
        apiBaseUrl: 'https://api.mindness.test',
        turnstileSiteKey: '0x4AAAAAAA',
      }),
    ).toEqual({ apiBaseUrl: 'https://api.mindness.test', turnstileSiteKey: '0x4AAAAAAA' })
  })

  it('treats an absent or blank value as an unconfigured optional feature', () => {
    expect(parseClientEnv({ apiBaseUrl: undefined, turnstileSiteKey: '  ' })).toEqual({
      apiBaseUrl: undefined,
      turnstileSiteKey: undefined,
    })
  })

  it('rejects an API base URL that is not a URL', () => {
    expect(() =>
      parseClientEnv({ apiBaseUrl: 'localhost:3333', turnstileSiteKey: undefined }),
    ).toThrow(EnvironmentError)
  })
})
