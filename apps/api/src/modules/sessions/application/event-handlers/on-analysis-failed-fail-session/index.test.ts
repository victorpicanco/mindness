import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

import { OnAnalysisFailedFailSession, type AnalysisFailedEvent } from './index.js'

describe('OnAnalysisFailedFailSession', () => {
  it('fails a processing session and releases quota once', async () => {
    const session = createProcessingSession()
    const repository = createRepository(session)
    const quota = createQuota()
    const handler = new OnAnalysisFailedFailSession(repository, quota)
    const event = createEvent()

    await handler.handle(event)
    await handler.handle(event)

    expect(session.state).toBe('failed')
    expect(repository.saved).toBe(1)
    expect(quota.released).toEqual(['session-id'])
  })

  it('releases the quota before persisting the failure so a crash between them can be retried', async () => {
    const session = createProcessingSession()
    const calls: string[] = []
    const repository = createRepository(session)
    const quota = createQuota()
    const handler = new OnAnalysisFailedFailSession(
      { ...repository, save: () => Promise.resolve(void calls.push('save')) },
      { ...quota, releaseReservation: () => Promise.resolve(void calls.push('release')) },
    )

    await handler.handle(createEvent())

    expect(calls).toEqual(['release', 'save'])
  })

  it('ignores a missing session', async () => {
    const repository = createRepository(null)
    const quota = createQuota()
    const handler = new OnAnalysisFailedFailSession(repository, quota)

    await expect(handler.handle(createEvent())).resolves.toBeUndefined()
    expect(quota.released).toEqual([])
  })
})

function createEvent(): AnalysisFailedEvent {
  const event: IntegrationEvent<'analysis_failed', AnalysisFailedEvent['payload']> = {
    eventId: 'event-id',
    eventName: 'analysis_failed',
    occurredAt: new Date('2026-08-20T12:00:00.000Z'),
    version: 1,
    payload: { sessionId: 'session-id' },
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
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    save: () => {
      saved += 1
      return Promise.resolve()
    },
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
