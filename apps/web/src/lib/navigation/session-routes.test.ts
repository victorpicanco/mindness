import { describe, expect, it } from 'vitest'

import { SESSIONS_ROUTE_PREFIX, sessionPath } from './session-routes'

describe('sessionPath', () => {
  it('places a session under the sessions route prefix', () => {
    expect(sessionPath('7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa')).toBe(
      '/sessions/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
    )
  })

  it('builds every session path under the prefix the proxy protects', () => {
    expect(sessionPath('any-id').startsWith(`${SESSIONS_ROUTE_PREFIX}/`)).toBe(true)
  })
})
