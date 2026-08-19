import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionAlreadyRunningError } from '@/modules/sessions/domain/errors/session-already-running-error/index.js'
import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { ThemesPort } from '@/modules/sessions/domain/ports/themes-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import { StartSessionUseCase } from './index.js'

const NOW = new Date('2026-08-19T00:00:00.000Z')

describe('StartSessionUseCase', () => {
  it('rejects a new session while the account has an unexpired session in progress', async () => {
    const calls: string[] = []
    const existingSession = Session.start({
      sessionId: 'session-1',
      accountId: 'account-1',
      themeId: 'theme-1',
      configuration: SessionConfiguration.create({
        difficulty: 'easy',
        categorySlug: 'self-awareness',
        searchWindowMinutes: 4,
      }),
      quotaReservationId: 'reservation-1',
      createdAt: new Date('2026-08-18T23:50:00.000Z'),
    })
    const sessions: SessionsRepository = {
      findById: () => Promise.resolve(null),
      findActiveByAccountId: () => Promise.resolve(existingSession),
      findExpiredInProgress: () => Promise.resolve([]),
      save: () => Promise.resolve(),
    }
    const themes: ThemesPort = {
      drawEligibleTheme: () => {
        calls.push('theme')
        return Promise.resolve(null)
      },
    }
    const quota: QuotaPort = {
      reserveForSession: () => {
        calls.push('quota')
        return Promise.resolve({ reservationId: 'reservation-2', enforced: true, remaining: 3 })
      },
      releaseReservation: () => Promise.resolve(),
    }
    const useCase = new StartSessionUseCase({
      sessions,
      themes,
      quota,
      clock: { now: () => NOW },
    })

    await expect(
      useCase.execute({
        accountId: 'account-1',
        difficulty: 'easy',
        categorySlug: 'self-awareness',
        searchWindowMinutes: 4,
      }),
    ).rejects.toEqual(new SessionAlreadyRunningError('session-1'))

    expect(calls).toEqual([])
  })
})
