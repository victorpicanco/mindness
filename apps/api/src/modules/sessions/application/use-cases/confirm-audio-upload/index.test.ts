import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { AudioSizeRejectedError } from '@/modules/sessions/domain/errors/audio-size-rejected-error/index.js'
import { AudioUploadFailedError } from '@/modules/sessions/domain/errors/audio-upload-failed-error/index.js'
import { AudioValidationRejectedError } from '@/modules/sessions/domain/errors/audio-validation-rejected-error/index.js'
import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'
import type { AudioStoragePort } from '@/modules/sessions/domain/ports/audio-storage-port/index.js'
import type {
  AudioValidationPort,
  ValidAudio,
} from '@/modules/sessions/domain/ports/audio-validation-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { MAX_AUDIO_SIZE_BYTES } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'

import { ConfirmAudioUploadUseCase } from './index.js'

const PATH = 'account-1/session-1/audio'
const CREATED_AT = new Date('2026-08-19T00:00:00.000Z')
const INSIDE_WINDOW = new Date('2026-08-19T00:01:00.000Z')
const PAST_DEADLINE = new Date('2026-08-19T00:15:00.000Z')

class AudioStorageRemovalError extends InfrastructureError {
  readonly code = 'sessions.AUDIO_STORAGE_PROVIDER_ERROR'

  constructor() {
    super('Audio storage removal failed')
  }
}

function createSession(accountId = 'account-1'): Session {
  return Session.start({
    sessionId: 'session-1',
    accountId,
    themeId: 'theme-1',
    configuration: SessionConfiguration.create({
      difficulty: 'hard',
      categorySlug: 'leadership',
      searchWindowMinutes: 5,
    }),
    quotaReservationId: 'reservation-1',
    createdAt: CREATED_AT,
  })
}

function createHarness(session: Session | null) {
  const calls: string[] = []
  const saved: Session[] = []
  const events = new FakeEventBus()
  let objectSize: number | null = 1_024
  let validation: ValidAudio | { readonly ok: false } = {
    ok: true,
    durationSeconds: 30,
    contentType: 'audio/webm',
  }
  let removeFails = false
  let transactionRuns = 0
  let now = INSIDE_WINDOW
  const sessions: SessionsRepository = {
    findById: () => Promise.resolve(session),
    findActiveByAccountId: () => Promise.resolve(null),
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    save: (value) => {
      calls.push('save')
      saved.push(value)
      return Promise.resolve()
    },
  }
  const audioStorage: AudioStoragePort = {
    createUploadUrl: () => Promise.resolve({ uploadUrl: '', token: '' }),
    getObjectSize: () => {
      calls.push('size')
      return Promise.resolve(objectSize)
    },
    downloadObject: () => {
      calls.push('download')
      return Promise.resolve(Buffer.from('audio'))
    },
    removeObject: () => {
      calls.push('remove')
      return removeFails ? Promise.reject(new AudioStorageRemovalError()) : Promise.resolve()
    },
  }
  const audioValidation: AudioValidationPort = {
    validate: () => {
      calls.push('validate')
      return Promise.resolve(validation)
    },
  }
  const useCase = new ConfirmAudioUploadUseCase({
    sessions,
    audioStorage,
    audioValidation,
    eventPublisher: events,
    idGenerator: { generate: () => 'event-1' },
    clock: { now: () => now },
    unitOfWork: {
      run: (operation) => {
        transactionRuns += 1
        return operation()
      },
    },
  })

  return {
    calls,
    events,
    saved,
    setObjectSize: (size: number | null) => {
      objectSize = size
    },
    setRemoveFails: () => {
      removeFails = true
    },
    setNow: (value: Date) => {
      now = value
    },
    setValidation: (result: ValidAudio | { readonly ok: false }) => {
      validation = result
    },
    transactionRuns: () => transactionRuns,
    useCase,
  }
}

describe('ConfirmAudioUploadUseCase', () => {
  it('rejects a missing upload without downloading or removing it', async () => {
    const harness = createHarness(createSession())
    harness.setObjectSize(null)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new AudioUploadFailedError(PATH))

    expect(harness.calls).toEqual(['size'])
  })

  it('removes an oversized upload before rejecting it', async () => {
    const harness = createHarness(createSession())
    harness.setObjectSize(MAX_AUDIO_SIZE_BYTES + 1)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new AudioSizeRejectedError(MAX_AUDIO_SIZE_BYTES + 1))

    expect(harness.calls).toEqual(['size', 'remove'])
  })

  it('removes an upload rejected by the audio validator', async () => {
    const harness = createHarness(createSession())
    harness.setValidation({ ok: false })

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new AudioValidationRejectedError(PATH))

    expect(harness.calls).toEqual(['size', 'download', 'validate', 'remove'])
  })

  it('removes an upload whose duration violates the domain limit', async () => {
    const harness = createHarness(createSession())
    harness.setValidation({ ok: true, durationSeconds: 61, contentType: 'audio/webm' })

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new AudioValidationRejectedError(PATH))

    expect(harness.calls).toEqual(['size', 'download', 'validate', 'remove'])
  })

  it('persists validated audio, moves the session to processing, and publishes RecordingSubmitted', async () => {
    const session = createSession()
    const harness = createHarness(session)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).resolves.toBeUndefined()

    expect(session.state).toBe('processing')
    expect(session.audio).toMatchObject({
      durationSeconds: 30,
      sizeBytes: 1_024,
      contentType: 'audio/webm',
      storagePath: PATH,
    })
    expect(harness.saved).toEqual([session])
    expect(harness.transactionRuns()).toBe(1)
    expect(harness.calls).toEqual(['size', 'download', 'validate', 'save'])
    expect(harness.events.published).toContainEqual(
      expect.objectContaining({
        eventName: 'recording_submitted',
        payload: { sessionId: 'session-1', accountId: 'account-1', durationSeconds: 30 },
      }),
    )
  })

  it('removes the expected orphan best-effort before rejecting a stale session', async () => {
    const session = createSession()
    session.expire('timeout', new Date('2026-08-19T00:15:00.000Z'))
    const harness = createHarness(session)
    harness.setRemoveFails()

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new SessionNotInProgressError('expired'))

    expect(harness.calls).toEqual(['remove'])
  })

  // DA-11 / D-09: the row still reads in_progress until a sweep closes it, but the deadline
  // has passed — the recording is an orphan, never a submission.
  it('removes the object and refuses a session whose window elapsed but was never swept', async () => {
    const session = createSession()
    const harness = createHarness(session)
    harness.setNow(PAST_DEADLINE)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new SessionNotInProgressError('expired'))

    expect(session.state).toBe('in_progress')
    expect(session.audio).toBeNull()
    expect(harness.calls).toEqual(['remove'])
    expect(harness.saved).toHaveLength(0)
    expect(harness.events.published).toHaveLength(0)
  })

  it('rejects an object that was created empty', async () => {
    const harness = createHarness(createSession())
    harness.setObjectSize(0)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new AudioUploadFailedError(PATH))

    expect(harness.calls).toEqual(['size'])
  })

  it.each([
    ['another account', createSession('account-2'), 'session-1'],
    ['an unknown session', null, 'missing-session'],
  ])('conceals %s without touching storage', async (_scenario, session, sessionId) => {
    const harness = createHarness(session)

    await expect(harness.useCase.execute({ accountId: 'account-1', sessionId })).rejects.toEqual(
      new SessionNotFoundError(sessionId),
    )

    expect(harness.calls).toHaveLength(0)
  })
})
