import { describe, expect, it } from 'vitest'

import { FindSessionProcessingContextUseCase } from './index.js'

describe('FindSessionProcessingContextUseCase', () => {
  it('returns the persisted processing context only when the session has accepted audio', async () => {
    const session = {
      id: 'session-id',
      accountId: 'account-id',
      themeId: 'theme-id',
      audio: { storagePath: 'audio-path' },
      recordedAt: new Date('2026-08-21T12:00:00.000Z'),
    }
    const useCase = new FindSessionProcessingContextUseCase({
      sessions: { findById: () => Promise.resolve(session) },
    })
    await expect(useCase.execute({ sessionId: session.id })).resolves.toEqual({
      sessionId: session.id,
      accountId: session.accountId,
      themeId: session.themeId,
      audioPath: 'audio-path',
      recordedAt: session.recordedAt,
    })
  })
  it('returns null for a missing session or an audio-less session', async () => {
    const useCase = new FindSessionProcessingContextUseCase({
      sessions: { findById: () => Promise.resolve(null) },
    })
    await expect(useCase.execute({ sessionId: 'session-id' })).resolves.toBeNull()
  })
})
