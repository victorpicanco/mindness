import { describe, expect, it } from 'vitest'

import { MicrophonePermissionDenied } from '@/modules/sessions/domain/events/microphone-permission-denied/index.js'
import { RecordingSubmitted } from '@/modules/sessions/domain/events/recording-submitted/index.js'
import { SessionExpired } from '@/modules/sessions/domain/events/session-expired/index.js'
import { SessionStarted } from '@/modules/sessions/domain/events/session-started/index.js'
import { ThemeUnavailable } from '@/modules/sessions/domain/events/theme-unavailable/index.js'

const occurredAt = new Date('2026-08-19T12:00:00.000Z')

describe('session domain events', () => {
  it.each([
    [
      SessionStarted.create({
        eventId: 'event-1',
        occurredAt,
        sessionId: 'session-1',
        accountId: 'account-1',
        difficulty: 'easy',
        categorySlug: 'mindfulness',
        searchWindowMinutes: 3,
        remaining: 3,
      }),
      'session_started',
      {
        sessionId: 'session-1',
        accountId: 'account-1',
        difficulty: 'easy',
        categorySlug: 'mindfulness',
        searchWindowMinutes: 3,
        surface: 'web',
        remaining: 3,
      },
    ],
    [
      SessionExpired.create({
        eventId: 'event-2',
        occurredAt,
        sessionId: 'session-1',
        accountId: 'account-1',
        stoppedAtStage: 'research',
      }),
      'session_expired',
      { sessionId: 'session-1', accountId: 'account-1', stoppedAtStage: 'research' },
    ],
    [
      RecordingSubmitted.create({
        eventId: 'event-3',
        occurredAt,
        sessionId: 'session-1',
        accountId: 'account-1',
        durationSeconds: 42,
      }),
      'recording_submitted',
      { sessionId: 'session-1', accountId: 'account-1', durationSeconds: 42 },
    ],
    [
      MicrophonePermissionDenied.create({
        eventId: 'event-4',
        occurredAt,
        sessionId: 'session-1',
        accountId: 'account-1',
      }),
      'microphone_permission_denied',
      { sessionId: 'session-1', accountId: 'account-1' },
    ],
    [
      ThemeUnavailable.create({
        eventId: 'event-5',
        occurredAt,
        accountId: 'account-1',
        categorySlug: 'mindfulness',
        difficulty: 'easy',
      }),
      'theme_unavailable',
      { accountId: 'account-1', categorySlug: 'mindfulness', difficulty: 'easy' },
    ],
  ])('carries the expected event envelope and primitive payload', (event, eventName, payload) => {
    expect(event.eventName).toBe(eventName)
    expect(event.version).toBe(1)
    expect(event.occurredAt).toEqual(occurredAt)
    expect(event.payload).toEqual(payload)
    expect(JSON.parse(JSON.stringify(event.payload))).toEqual(event.payload)
  })
})
