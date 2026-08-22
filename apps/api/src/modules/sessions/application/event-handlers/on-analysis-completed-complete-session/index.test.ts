import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

import { OnAnalysisCompletedCompleteSession, type AnalysisCompletedEvent } from './index.js'

describe('OnAnalysisCompletedCompleteSession', () => {
  it('completes a processing session without releasing quota', async () => {
    const session = createProcessingSession()
    const repository = createRepository(session)
    const handler = new OnAnalysisCompletedCompleteSession(repository)

    await handler.handle(createEvent())

    expect(session.state).toBe('completed')
    expect(session.totalScore).toBe(87)
    expect(repository.saved).toBe(1)
  })

  it('ignores a missing session', async () => {
    const repository = createRepository(null)
    const handler = new OnAnalysisCompletedCompleteSession(repository)

    await expect(handler.handle(createEvent())).resolves.toBeUndefined()
    expect(repository.saved).toBe(0)
  })
})

function createEvent(): AnalysisCompletedEvent {
  const event: IntegrationEvent<'analysis_completed', AnalysisCompletedEvent['payload']> = {
    eventId: 'event-id',
    eventName: 'analysis_completed',
    occurredAt: new Date('2026-08-20T12:00:00.000Z'),
    version: 1,
    payload: { sessionId: 'session-id', scores: { total: 87 } },
  }
  return event
}

function createProcessingSession(): Session {
  const session = Session.start({
    sessionId: 'session-id',
    accountId: 'account-id',
    themeId: 'theme-id',
    configuration: SessionConfiguration.create({
      difficulty: 'balanced',
      categorySlug: 'general',
      searchWindowMinutes: 4,
    }),
    quotaReservationId: 'reservation-id',
    createdAt: new Date('2026-08-20T11:00:00.000Z'),
  })
  session.acceptAudio(
    SessionAudio.create({
      id: 'audio-id',
      durationSeconds: 1,
      sizeBytes: 1,
      contentType: 'audio/webm',
      storagePath: 'path',
    }),
    new Date('2026-08-20T11:01:00.000Z'),
  )
  return session
}

function createRepository(session: Session | null): SessionsRepository & { saved: number } {
  let saved = 0
  return {
    get saved() {
      return saved
    },
    findById: () => Promise.resolve(session),
    findActiveByAccountId: () => Promise.resolve(null),
    listByAccount: () => Promise.resolve([]),
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    save: () => {
      saved += 1
      return Promise.resolve()
    },
  }
}
