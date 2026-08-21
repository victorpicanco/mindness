import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import { DownloadSessionAudioUseCase } from './index.js'

function createSessionWithAudio(): Session {
  const session = Session.start({
    sessionId: 'session-id',
    accountId: 'account-id',
    themeId: 'theme-id',
    configuration: SessionConfiguration.create({
      difficulty: 'balanced',
      categorySlug: 'communication',
      searchWindowMinutes: 4,
    }),
    quotaReservationId: 'reservation-id',
    createdAt: new Date('2026-08-21T11:00:00.000Z'),
  })
  session.acceptAudio(
    SessionAudio.create({
      id: 'audio-id',
      durationSeconds: 30,
      sizeBytes: 1_024,
      contentType: 'audio/webm',
      storagePath: 'audio-path',
    }),
    new Date('2026-08-21T11:05:00.000Z'),
  )
  return session
}

describe('DownloadSessionAudioUseCase', () => {
  it('downloads the audio using the session storage path', async () => {
    const audio = Buffer.from('audio')
    const session = createSessionWithAudio()
    const useCase = new DownloadSessionAudioUseCase({
      sessions: { findById: () => Promise.resolve(session) },
      audioStorage: {
        downloadObject: (path: string) =>
          Promise.resolve(path === 'audio-path' ? audio : Buffer.alloc(0)),
      },
    })
    await expect(useCase.execute({ sessionId: 'session-id' })).resolves.toBe(audio)
  })

  it('throws when the session has no accepted audio', async () => {
    const useCase = new DownloadSessionAudioUseCase({
      sessions: { findById: () => Promise.resolve(null) },
      audioStorage: { downloadObject: () => Promise.resolve(Buffer.alloc(0)) },
    })

    await expect(useCase.execute({ sessionId: 'session-id' })).rejects.toMatchObject({
      code: 'sessions.SESSION_NOT_FOUND',
    })
  })
})
