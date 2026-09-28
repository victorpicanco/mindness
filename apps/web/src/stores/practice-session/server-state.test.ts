import { afterEach, describe, expect, it, vi } from 'vitest'

import { practiceSessionInitialState } from './server-state'

const ACTIVE_SESSION = {
  configuration: {
    categorySlug: 'focus',
    difficulty: 'balanced',
    searchWindowMinutes: 3,
  } as const,
  createdAt: '2026-08-24T12:00:00.000Z',
  expiresAt: '2026-08-24T12:08:00.000Z',
  recordingStartedAt: null,
  researchEndsAt: '2026-08-24T12:03:00.000Z',
  serverNow: '2026-08-24T12:00:00.000Z',
  sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
  themeId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
  themeTitle: 'Communicating with clarity',
}

describe('practiceSessionInitialState', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the session researching while the research window is open', () => {
    expect(practiceSessionInitialState(ACTIVE_SESSION)).toMatchObject({
      session: { sessionId: ACTIVE_SESSION.sessionId },
      status: 'researching',
    })
  })

  it('opens the recording window once the research deadline has passed', () => {
    expect(
      practiceSessionInitialState({ ...ACTIVE_SESSION, serverNow: '2026-08-24T12:03:00.000Z' })
        .status,
    ).toBe('awaiting-recording')
  })

  it('expires a session whose recording was already started elsewhere', () => {
    expect(
      practiceSessionInitialState({
        ...ACTIVE_SESSION,
        recordingStartedAt: '2026-08-24T12:04:00.000Z',
      }).status,
    ).toBe('expired')
  })

  it('measures the offset between the server clock and the browser clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T11:55:00.000Z'))

    expect(practiceSessionInitialState(ACTIVE_SESSION).serverTimeOffsetMs).toBe(5 * 60 * 1_000)
  })
})
