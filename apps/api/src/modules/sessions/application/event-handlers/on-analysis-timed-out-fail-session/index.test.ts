import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

import { OnAnalysisTimedOutFailSession, type AnalysisTimedOutEvent } from './index.js'

describe('OnAnalysisTimedOutFailSession', () => {
  it('releases the quota before persisting the failure so a crash between them can be retried', async () => {
    const session = createProcessingSession()
    const calls: string[] = []
    const repository = createRepository(session)
    const quota = createQuota()
    const handler = new OnAnalysisTimedOutFailSession(
      { ...repository, save: () => Promise.resolve(void calls.push('save')) },
      { ...quota, releaseReservation: () => Promise.resolve(void calls.push('release')) },
    )
    const event: IntegrationEvent<'analysis_timeout', AnalysisTimedOutEvent['payload']> = {
      eventId: 'event-id',
      eventName: 'analysis_timeout',
      occurredAt: new Date(),
      version: 1,
      payload: { sessionId: 'session-id' },
    }

    await handler.handle(event)

    expect(calls).toEqual(['release', 'save'])
  })
  it('fails a processing session and releases quota once', async () => {
    const session = createProcessingSession()
    const repository = createRepository(session)
    const quota = createQuota()
    const handler = new OnAnalysisTimedOutFailSession(repository, quota)
    const event: IntegrationEvent<'analysis_timeout', AnalysisTimedOutEvent['payload']> = {
      eventId: 'event-id',
      eventName: 'analysis_timeout',
      occurredAt: new Date(),
      version: 1,
      payload: { sessionId: 'session-id' },
    }

    await handler.handle(event)
    await handler.handle(event)

    expect(session.state).toBe('failed')
    expect(quota.released).toEqual(['session-id'])
  })
})

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

function createRepository(session: Session): SessionsRepository {
  return {
    findById: () => Promise.resolve(session),
    findActiveByAccountId: () => Promise.resolve(null),
    listByAccount: () => Promise.resolve([]),
    findCompletedBetween: () => Promise.resolve([]),
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    save: () => Promise.resolve(),
  }
}

function createQuota(): QuotaPort & { released: string[] } {
  const released: string[] = []
  return {
    released,
    reserveForSession: ({ sessionId }) =>
      Promise.resolve({ reservationId: sessionId, enforced: true, remaining: 0 }),
    releaseReservation: ({ sessionId }) => {
      released.push(sessionId)
      return Promise.resolve()
    },
  }
}
