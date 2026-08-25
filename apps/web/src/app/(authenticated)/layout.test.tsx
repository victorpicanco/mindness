import { describe, expect, it } from 'vitest'

import { sessionNavigationItems } from './layout'

describe('authenticated layout session navigation', () => {
  it('maps the server session aggregate to stable dynamic links', () => {
    expect(
      sessionNavigationItems([
        {
          bestOfDay: false,
          categorySlug: 'focus',
          difficulty: 'balanced',
          localDate: '24/08/2026',
          localTime: '09:00',
          sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
          startedAt: '2026-08-24T12:00:00.000Z',
          state: 'in_progress',
          totalScore: null,
        },
      ]),
    ).toEqual([
      {
        href: '/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
        icon: 'clock-01',
        label: 'focus · 24/08/2026 09:00',
      },
    ])
  })
})
