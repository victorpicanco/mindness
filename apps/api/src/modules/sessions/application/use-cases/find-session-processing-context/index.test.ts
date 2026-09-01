import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import { FindSessionProcessingContextUseCase } from './index.js'

const CREATED_AT = new Date('2026-08-21T11:00:00.000Z')
const RECORDED_AT = new Date('2026-08-21T11:05:00.000Z')

function createConfiguration(): SessionConfiguration {
  return SessionConfiguration.create({
    difficulty: 'balanced',
    categorySlug: 'communication',
    searchWindowMinutes: 4,
  })
}

function createProcessingSession(): Session {
  const session = Session.start({
    sessionId: 'session-id',
    accountId: 'account-id',
    themeId: 'theme-id',
    configuration: createConfiguration(),
    createdAt: CREATED_AT,
  })
  session.acceptAudio(
    SessionAudio.create({
      id: 'audio-id',
      durationSeconds: 30,
      sizeBytes: 1_024,
      contentType: 'audio/webm',
      storagePath: 'audio-path',
    }),
    RECORDED_AT,
  )
  return session
}

function createRepository(session: Session | null): Pick<SessionsRepository, 'findById'> {
  return { findById: () => Promise.resolve(session) }
}

describe('FindSessionProcessingContextUseCase', () => {
  it('returns the persisted processing context only when the session has accepted audio', async () => {
    const session = createProcessingSession()
    const useCase = new FindSessionProcessingContextUseCase({
      sessions: createRepository(session),
    })

    await expect(useCase.execute({ sessionId: session.id })).resolves.toEqual({
      sessionId: session.id,
      accountId: session.accountId,
      themeId: session.themeId,
      audioPath: 'audio-path',
      recordedAt: RECORDED_AT,
    })
  })

  it('returns null for a missing session', async () => {
    const useCase = new FindSessionProcessingContextUseCase({ sessions: createRepository(null) })
    await expect(useCase.execute({ sessionId: 'session-id' })).resolves.toBeNull()
  })

  it.each(['in_progress', 'completed', 'failed', 'expired', 'deleted'] as const)(
    'returns null when the session is %s instead of processing',
    async (state) => {
      const session = createProcessingSession()
      const reconstituted = Session.reconstitute({
        sessionId: session.id,
        accountId: session.accountId,
        themeId: session.themeId,
        configuration: createConfiguration(),
        state,
        createdAt: CREATED_AT,
        expiresAt: session.expiresAt,
        expiredReason: null,
        expiredAt: null,
        audio: session.audio,
        recordedAt: session.recordedAt,
      })
      const useCase = new FindSessionProcessingContextUseCase({
        sessions: createRepository(reconstituted),
      })

      await expect(useCase.execute({ sessionId: session.id })).resolves.toBeNull()
    },
  )
})
