import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'
import type { AudioStoragePort } from '@/modules/sessions/domain/ports/audio-storage-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import { RequestAudioUploadUrlUseCase } from './index.js'

const CREATED_AT = new Date('2026-08-19T00:00:00.000Z')
const INSIDE_WINDOW = new Date('2026-08-19T00:01:00.000Z')
const PAST_DEADLINE = new Date('2026-08-19T00:15:00.000Z')

function createSession(accountId = 'account-1'): Session {
  return Session.start({
    sessionId: 'session-1',
    accountId,
    themeId: 'theme-1',
    configuration: SessionConfiguration.create({
      difficulty: 'balanced',
      categorySlug: 'communication',
      searchWindowMinutes: 4,
    }),
    quotaReservationId: 'reservation-1',
    createdAt: CREATED_AT,
  })
}

function createHarness(session: Session | null, now: Date = INSIDE_WINDOW) {
  const paths: string[] = []
  const sessions: SessionsRepository = {
    findById: () => Promise.resolve(session),
    findActiveByAccountId: () => Promise.resolve(null),
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    save: () => Promise.resolve(),
  }
  const audioStorage: AudioStoragePort = {
    createUploadUrl: (path) => {
      paths.push(path)
      return Promise.resolve({ uploadUrl: 'https://storage.test/upload', token: 'upload-token' })
    },
    getObjectSize: () => Promise.resolve(null),
    downloadObject: () => Promise.resolve(Buffer.alloc(0)),
    removeObject: () => Promise.resolve(),
  }

  return {
    paths,
    useCase: new RequestAudioUploadUrlUseCase({
      sessions,
      audioStorage,
      clock: { now: () => now },
    }),
  }
}

describe('RequestAudioUploadUrlUseCase', () => {
  it('creates a temporary upload credential for an in-progress session owned by the account', async () => {
    const harness = createHarness(createSession())

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).resolves.toEqual({
      uploadUrl: 'https://storage.test/upload',
      token: 'upload-token',
      path: 'account-1/session-1/audio',
    })

    expect(harness.paths).toEqual(['account-1/session-1/audio'])
  })

  it('conceals a session owned by another account', async () => {
    const harness = createHarness(createSession('account-2'))

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new SessionNotFoundError('session-1'))

    expect(harness.paths).toHaveLength(0)
  })

  it('rejects an unknown session', async () => {
    const harness = createHarness(null)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'missing-session' }),
    ).rejects.toEqual(new SessionNotFoundError('missing-session'))
  })

  it('rejects a session that is no longer in progress', async () => {
    const session = createSession()
    session.acceptAudio(
      SessionAudio.create({
        id: 'audio-1',
        durationSeconds: 1,
        sizeBytes: 1,
        contentType: 'audio/webm',
        storagePath: 'account-1/session-1/audio',
      }),
      INSIDE_WINDOW,
    )
    const harness = createHarness(session)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new SessionNotInProgressError('processing'))

    expect(harness.paths).toHaveLength(0)
  })

  // D-05: the credential must not outlive the session's own fifteen-minute window, even
  // before a sweep has written the expired state.
  it('refuses a credential once the window elapsed but the row still reads in_progress', async () => {
    const harness = createHarness(createSession(), PAST_DEADLINE)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new SessionNotInProgressError('expired'))

    expect(harness.paths).toHaveLength(0)
  })
})
