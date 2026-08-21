import { describe, expect, it } from 'vitest'

import type { SessionsModuleDeps } from './container.js'
import { registerSessionsModule } from './register.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import type { SessionRow } from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'

describe('registerSessionsModule', () => {
  it('subscribes to the three analysis lifecycle events', async () => {
    const subscriptions: string[] = []
    const app = buildApp({ logger: createLogger({ level: 'silent', pretty: false }) })

    await registerSessionsModule(app, createDependencies(subscriptions))

    expect(subscriptions).toEqual(['analysis_completed', 'analysis_failed', 'analysis_timeout'])
    await app.close()
  })
})

function createDependencies(subscriptions: string[]): SessionsModuleDeps {
  return {
    prisma: {
      session: {
        findUnique: () => Promise.resolve(null),
        findFirst: () => Promise.resolve(null),
        findMany: () => Promise.resolve([]),
        upsert: () => Promise.resolve(createSessionRow()),
      },
      $transaction: async (operation) => operation(createDependencies(subscriptions).prisma),
    },
    clock: { now: () => new Date() },
    idGenerator: { generate: () => 'id' },
    eventPublisher: { publish: () => Promise.resolve() },
    eventSubscriber: { subscribe: (eventName) => subscriptions.push(eventName) },
    adapters: {
      accounts: { resolveAccountId: () => Promise.resolve(null) },
      themes: { drawEligibleTheme: () => Promise.resolve(null) },
      quota: {
        reserveForSession: () =>
          Promise.resolve({ reservationId: 'id', enforced: true, remaining: 0 }),
        releaseReservation: () => Promise.resolve(),
      },
      audioStorage: {
        createUploadUrl: () => Promise.resolve({ uploadUrl: 'memory://upload', token: 'token' }),
        getObjectSize: () => Promise.resolve(null),
        downloadObject: () => Promise.resolve(Buffer.from('audio')),
        removeObject: () => Promise.resolve(),
      },
    },
  }
}

function createSessionRow(): SessionRow {
  return {
    id: 'session-id',
    accountId: 'account-id',
    themeId: 'theme-id',
    difficulty: 'balanced',
    categorySlug: 'general',
    searchWindowMinutes: 4,
    quotaReservationId: 'reservation-id',
    state: 'in_progress',
    expiredReason: null,
    createdAt: new Date(),
    expiresAt: new Date(),
    expiredAt: null,
    recordedAt: null,
    totalScore: null,
    completedAt: null,
    audio: null,
  }
}
