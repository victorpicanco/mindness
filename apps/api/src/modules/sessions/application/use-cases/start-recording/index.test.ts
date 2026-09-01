import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { RecordingWindowNotOpenError } from '@/modules/sessions/domain/errors/recording-window-not-open-error/index.js'
import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'

import { StartRecordingUseCase } from './index.js'

const NOW = new Date('2026-08-19T00:05:00.000Z')
const CREATED_AT = new Date('2026-08-19T00:00:00.000Z')
const RESEARCH_ENDS_AT = new Date('2026-08-19T00:04:00.000Z')
const SESSION_DEADLINE = new Date('2026-08-19T00:15:00.000Z')
const VALID_INPUT = { accountId: 'account-1', sessionId: 'session-1' }

function createConfiguration(): SessionConfiguration {
  return SessionConfiguration.create({
    difficulty: 'balanced',
    categorySlug: 'communication',
    searchWindowMinutes: 4,
  })
}

function createSession(createdAt: Date): Session {
  return Session.start({
    sessionId: 'session-1',
    accountId: 'account-1',
    themeId: 'theme-1',
    configuration: createConfiguration(),
    createdAt,
  })
}

function createHarness(session: Session | null) {
  const saved: Session[] = []
  const events = new FakeEventBus()
  let transactionRuns = 0
  const sessions: SessionsRepository = {
    findById: () => Promise.resolve(session),
    findActiveByAccountId: () => Promise.resolve(session),
    listByAccount: () => Promise.resolve([]),
    findCompletedBetween: () => Promise.resolve([]),
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    markDeleted: () => Promise.resolve(true),
    save: (saving) => {
      saved.push(saving)
      return Promise.resolve()
    },
  }
  const useCase = new StartRecordingUseCase({
    sessions,
    clock: { now: () => NOW },
    eventPublisher: events,
    idGenerator: { generate: () => 'event-1' },
    unitOfWork: {
      run: (operation) => {
        transactionRuns += 1
        return operation()
      },
    },
  })

  return { events, saved, transactionRuns: () => transactionRuns, useCase }
}

describe('StartRecordingUseCase', () => {
  it('opens the recording and extends the session deadline', async () => {
    const harness = createHarness(createSession(CREATED_AT))

    await expect(harness.useCase.execute(VALID_INPUT)).resolves.toEqual({
      recordingStartedAt: NOW.toISOString(),
      expiresAt: SESSION_DEADLINE.toISOString(),
    })

    expect(harness.saved).toHaveLength(1)
    expect(harness.saved[0]?.recordingStartedAt).toEqual(NOW)
    expect(harness.saved[0]?.expiresAt).toEqual(SESSION_DEADLINE)
    expect(harness.saved[0]?.state).toBe('in_progress')
    expect(harness.transactionRuns()).toBe(1)
    expect(harness.events.published).toEqual([])
  })

  it('keeps the first recording instant when the same session is opened twice', async () => {
    const session = createSession(CREATED_AT)
    session.startRecording(RESEARCH_ENDS_AT)
    const harness = createHarness(session)

    await expect(harness.useCase.execute(VALID_INPUT)).resolves.toEqual({
      recordingStartedAt: RESEARCH_ENDS_AT.toISOString(),
      expiresAt: SESSION_DEADLINE.toISOString(),
    })
  })

  it('refuses to open the recording while the research window is still running', async () => {
    const harness = createHarness(createSession(new Date('2026-08-19T00:02:00.000Z')))

    await expect(harness.useCase.execute(VALID_INPUT)).rejects.toThrow(RecordingWindowNotOpenError)

    expect(harness.saved).toEqual([])
  })

  it('expires the session and refuses when the two-minute grace has elapsed', async () => {
    const harness = createHarness(createSession(new Date('2026-08-18T23:55:00.000Z')))

    await expect(harness.useCase.execute(VALID_INPUT)).rejects.toThrow(SessionNotInProgressError)

    expect(harness.saved).toHaveLength(1)
    expect(harness.saved[0]?.state).toBe('expired')
    expect(harness.saved[0]?.expiredReason).toBe('timeout')
    expect(harness.events.published[0]).toMatchObject({
      eventName: 'session_expired',
      payload: { sessionId: 'session-1', stoppedAtStage: 'in_progress' },
    })
  })

  it('rejects a session that belongs to another account', async () => {
    const harness = createHarness(createSession(CREATED_AT))

    await expect(
      harness.useCase.execute({ accountId: 'account-2', sessionId: 'session-1' }),
    ).rejects.toThrow(SessionNotFoundError)

    expect(harness.saved).toEqual([])
  })

  it('rejects an unknown session', async () => {
    const harness = createHarness(null)

    await expect(harness.useCase.execute(VALID_INPUT)).rejects.toThrow(SessionNotFoundError)

    expect(harness.saved).toEqual([])
  })
})
