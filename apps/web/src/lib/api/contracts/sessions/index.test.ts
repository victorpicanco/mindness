import { describe, expect, it } from 'vitest'

import {
  activeSessionSchema,
  quotaSchema,
  sessionHistorySchema,
} from '@/lib/api/contracts/sessions'

const activeSession = {
  configuration: { categorySlug: 'focus', difficulty: 'balanced', searchWindowMinutes: 4 },
  createdAt: '2026-08-24T11:50:00.000Z',
  expiresAt: '2026-08-24T12:05:00.000Z',
  recordingStartedAt: null,
  researchEndsAt: '2026-08-24T12:03:00.000Z',
  sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
  themeId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
  themeTitle: 'Comunicação clara',
}

describe('session API contracts', () => {
  it('requires the nullable recording start timestamp in active sessions', () => {
    expect(activeSessionSchema.parse(activeSession)).toEqual(activeSession)

    const missingTimestamp = { ...activeSession, recordingStartedAt: undefined }

    expect(() => activeSessionSchema.parse(missingTimestamp)).toThrow()
  })

  it('accepts both enforced and unlimited quota responses', () => {
    expect(quotaSchema.parse({ enforced: false })).toEqual({ enforced: false })
    expect(
      quotaSchema.parse({
        allowance: 4,
        enforced: true,
        remaining: 2,
        renewsAt: '2026-09-01T12:05:00.000Z',
      }),
    ).toMatchObject({ allowance: 4, remaining: 2 })
  })

  it('validates the session history aggregate', () => {
    expect(
      sessionHistorySchema.parse([
        {
          bestOfDay: true,
          categorySlug: 'focus',
          difficulty: 'balanced',
          localDate: '24/08/2026',
          localTime: '09:00',
          sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
          startedAt: '2026-08-24T12:00:00.000Z',
          state: 'completed',
          totalScore: 87,
        },
      ]),
    ).toHaveLength(1)
  })
})
