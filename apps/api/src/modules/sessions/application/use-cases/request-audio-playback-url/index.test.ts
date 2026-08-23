import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { AudioUnavailableError } from '@/modules/sessions/domain/errors/audio-unavailable-error/index.js'
import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import type { AudioStoragePort } from '@/modules/sessions/domain/ports/audio-storage-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { AUDIO_PLAYBACK_URL_TTL_SECONDS } from '@/modules/sessions/domain/services/audio-playback-window/index.js'
import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import { RequestAudioPlaybackUrlUseCase } from './index.js'

const NOW = new Date('2026-08-22T12:00:00.000Z')
const STORAGE_PATH = 'account-1/session-1/audio'

function createSession(params: {
  readonly accountId?: string
  readonly audio?: boolean
  readonly state?: 'completed' | 'deleted' | 'processing' | 'failed'
}): Session {
  const state = params.state ?? 'completed'
  return Session.reconstitute({
    sessionId: 'session-1',
    accountId: params.accountId ?? 'account-1',
    themeId: 'theme-1',
    configuration: SessionConfiguration.create({
      difficulty: 'easy',
      categorySlug: 'self-awareness',
      searchWindowMinutes: 4,
    }),
    quotaReservationId: 'reservation-1',
    state,
    createdAt: new Date('2026-08-22T10:00:00.000Z'),
    expiresAt: new Date('2026-08-22T10:15:00.000Z'),
    expiredReason: null,
    expiredAt: null,
    recordedAt: params.audio ? new Date('2026-08-22T10:01:00.000Z') : null,
    totalScore: 80,
    completedAt: new Date('2026-08-22T10:05:00.000Z'),
    deletedAt: state === 'deleted' ? new Date('2026-08-22T11:00:00.000Z') : null,
    audio: params.audio
      ? SessionAudio.create({
          id: 'audio-1',
          durationSeconds: 10,
          sizeBytes: 100,
          contentType: 'audio/webm',
          storagePath: STORAGE_PATH,
        })
      : null,
  })
}

function createHarness(session: Session | null, objectSize: number | null = 100) {
  const downloadCalls: { readonly path: string; readonly expiresInSeconds: number }[] = []
  const sessions: SessionsRepository = {
    findById: () => Promise.resolve(session),
    findActiveByAccountId: () => Promise.resolve(null),
    listByAccount: () => Promise.resolve([]),
    findCompletedBetween: () => Promise.resolve([]),
    findExpiredInProgress: () => Promise.resolve([]),
    findStuckProcessing: () => Promise.resolve([]),
    markDeleted: () => Promise.resolve(true),
    save: () => Promise.resolve(),
  }
  const audioStorage: AudioStoragePort = {
    createUploadUrl: () => Promise.resolve({ uploadUrl: '', token: '' }),
    createDownloadUrl: (path, expiresInSeconds) => {
      downloadCalls.push({ path, expiresInSeconds })
      return Promise.resolve('https://storage.test/signed-url')
    },
    getObjectSize: () => Promise.resolve(objectSize),
    downloadObject: () => Promise.resolve(Buffer.alloc(0)),
    removeObject: () => Promise.resolve(),
  }
  return {
    downloadCalls,
    useCase: new RequestAudioPlaybackUrlUseCase({
      sessions,
      audioStorage,
      clock: { now: () => NOW },
    }),
  }
}

describe('RequestAudioPlaybackUrlUseCase', () => {
  it('issues a signed playback URL for an owned completed session with stored audio', async () => {
    const harness = createHarness(createSession({ audio: true }))

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).resolves.toEqual({
      signedUrl: 'https://storage.test/signed-url',
      expiresAt: '2026-08-22T12:02:00.000Z',
    })
    expect(harness.downloadCalls).toEqual([
      { path: STORAGE_PATH, expiresInSeconds: AUDIO_PLAYBACK_URL_TTL_SECONDS },
    ])
  })

  // Playback is about the recording, not about the analysis: a session whose analysis is still
  // running or has failed still owns audio the person may replay. Only `deleted` hides it.
  it.each([['processing' as const], ['failed' as const]])(
    'still issues a credential for an owned %s session with stored audio',
    async (state) => {
      const harness = createHarness(createSession({ audio: true, state }))

      await expect(
        harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
      ).resolves.toMatchObject({ signedUrl: 'https://storage.test/signed-url' })
    },
  )

  it.each([
    ['another account', createSession({ accountId: 'account-2', audio: true })],
    ['a missing session', null],
    ['a deleted session', createSession({ audio: true, state: 'deleted' })],
  ])('conceals %s', async (_caseName, session) => {
    const harness = createHarness(session)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new SessionNotFoundError('session-1'))
  })

  it('rejects a session with no audio', async () => {
    const harness = createHarness(createSession({ audio: false }))

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new AudioUnavailableError('session-1'))
  })

  it('rejects a missing stored object without signing a URL', async () => {
    const harness = createHarness(createSession({ audio: true }), null)

    await expect(
      harness.useCase.execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).rejects.toEqual(new AudioUnavailableError('session-1'))
    expect(harness.downloadCalls).toHaveLength(0)
  })
})
