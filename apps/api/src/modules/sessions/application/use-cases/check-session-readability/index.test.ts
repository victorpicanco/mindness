import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import type { SessionState } from '@/modules/sessions/domain/entities/session/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import { CheckSessionReadabilityUseCase } from './index.js'

function createSession(
  params: { readonly accountId?: string; readonly state?: SessionState } = {},
): Session {
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
    expiredReason: state === 'expired' ? 'timeout' : null,
    expiredAt: state === 'expired' ? new Date('2026-08-22T10:15:00.000Z') : null,
    recordedAt: null,
    totalScore: state === 'completed' ? 80 : null,
    completedAt: state === 'completed' ? new Date('2026-08-22T10:05:00.000Z') : null,
    failedAt: state === 'failed' ? new Date('2026-08-22T10:05:00.000Z') : null,
    deletedAt: state === 'deleted' ? new Date('2026-08-22T11:00:00.000Z') : null,
  })
}

function createUseCase(session: Session | null): CheckSessionReadabilityUseCase {
  const sessions: Pick<SessionsRepository, 'findById'> = {
    findById: () => Promise.resolve(session),
  }
  return new CheckSessionReadabilityUseCase({ sessions })
}

describe('CheckSessionReadabilityUseCase', () => {
  it.each(['in_progress', 'expired', 'processing', 'completed', 'failed'] as const)(
    'returns readable for an owned %s session',
    async (state) => {
      await expect(
        createUseCase(createSession({ state })).execute({
          accountId: 'account-1',
          sessionId: 'session-1',
        }),
      ).resolves.toEqual({ readable: true })
    },
  )

  it.each([
    ['a missing session', null],
    ['a session owned by another account', createSession({ accountId: 'account-2' })],
    ['a deleted session', createSession({ state: 'deleted' })],
  ])('returns unreadable for %s', async (_caseName, session) => {
    await expect(
      createUseCase(session).execute({ accountId: 'account-1', sessionId: 'session-1' }),
    ).resolves.toEqual({ readable: false })
  })
})
