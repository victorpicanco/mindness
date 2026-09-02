import { describe, expect, it } from 'vitest'

import {
  activeSessionSchema,
  deleteSessionSchema,
  recordingStartedSchema,
  startedSessionSchema,
  sessionHistorySchema,
} from '@/lib/api/contracts/sessions'

const activeSession = {
  configuration: { categorySlug: 'focus', difficulty: 'balanced', searchWindowMinutes: 4 },
  createdAt: '2026-08-24T11:50:00.000Z',
  expiresAt: '2026-08-24T12:05:00.000Z',
  recordingStartedAt: null,
  researchEndsAt: '2026-08-24T12:03:00.000Z',
  serverNow: '2026-08-24T12:00:00.000Z',
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

  it('requires the server clock and rejects undeclared active session fields', () => {
    const missingServerNow = { ...activeSession, serverNow: undefined }

    expect(() => activeSessionSchema.parse(missingServerNow)).toThrow()
    expect(() => activeSessionSchema.parse({ ...activeSession, undeclared: true })).toThrow()
  })

  it('preserves the deadline returned when a recording starts', () => {
    const response = {
      expiresAt: '2026-08-24T12:15:00.000Z',
      recordingStartedAt: '2026-08-24T12:04:00.000Z',
    }

    expect(recordingStartedSchema.parse(response)).toEqual(response)
  })

  it('preserves the theme returned from a started session', () => {
    const response = {
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:15:00.000Z',
      researchEndsAt: '2026-08-24T12:03:00.000Z',
      serverNow: '2026-08-24T12:00:00.000Z',
      sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
      themeId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
      themeTitle: 'Comunicação clara',
    }

    expect(startedSessionSchema.parse(response)).toEqual(response)
    expect(() => startedSessionSchema.parse({ ...response, undeclared: true })).toThrow()
  })

  it('validates the session history aggregate', () => {
    expect(
      sessionHistorySchema.parse([
        {
          categorySlug: 'focus',
          difficulty: 'balanced',
          localDate: '24/08/2026',
          localTime: '09:00',
          sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
          startedAt: '2026-08-24T12:00:00.000Z',
          state: 'completed',
          themeTitle: 'Notícias do dia',
        },
      ]),
    ).toHaveLength(1)
  })

  it('accepts the empty body a deleted session responds with', () => {
    expect(deleteSessionSchema.parse(null)).toBeNull()
    expect(() => deleteSessionSchema.parse({})).toThrow()
  })
})
