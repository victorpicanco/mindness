import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import { ListStuckProcessingSessionsUseCase } from './index.js'

function createProcessingSession(sessionId: string, recordedAt: Date): Session {
  const session = Session.start({
    sessionId,
    accountId: `account-${sessionId}`,
    themeId: `theme-${sessionId}`,
    configuration: SessionConfiguration.create({
      difficulty: 'balanced',
      categorySlug: 'communication',
      searchWindowMinutes: 4,
    }),
    createdAt: new Date('2026-08-21T11:00:00.000Z'),
  })
  session.acceptAudio(
    SessionAudio.create({
      id: `audio-${sessionId}`,
      durationSeconds: 30,
      sizeBytes: 1_024,
      contentType: 'audio/webm',
      storagePath: `audio-path-${sessionId}`,
    }),
    recordedAt,
  )
  return session
}

describe('ListStuckProcessingSessionsUseCase', () => {
  it('returns the ids of the sessions the repository reports as stuck', async () => {
    const before = new Date('2026-08-21T11:05:00.000Z')
    const stuckSessions = [
      createProcessingSession('session-1', new Date('2026-08-21T11:03:00.000Z')),
      createProcessingSession('session-2', new Date('2026-08-21T11:04:00.000Z')),
    ]
    const queries: { before: Date; limit: number }[] = []
    const sessions: Pick<SessionsRepository, 'findStuckProcessing'> = {
      findStuckProcessing: (queriedBefore, limit) => {
        queries.push({ before: queriedBefore, limit })
        return Promise.resolve(stuckSessions)
      },
    }
    const useCase = new ListStuckProcessingSessionsUseCase({ sessions })

    await expect(useCase.execute({ before, limit: 50 })).resolves.toEqual([
      'session-1',
      'session-2',
    ])
    expect(queries).toEqual([{ before, limit: 50 }])
  })
})
