import { describe, expect, it, vi } from 'vitest'

import type { SessionsModuleDeps } from './container.js'
import { registerSessionsModule } from './register.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import type { SessionRow } from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

type EventHandler = (event: IntegrationEvent) => Promise<void>

describe('registerSessionsModule', () => {
  it('subscribes to the three analysis lifecycle events', async () => {
    const subscriptions: string[] = []
    const app = buildApp({ logger: createLogger({ level: 'silent', pretty: false }) })

    await registerSessionsModule(app, createDependencies(subscriptions))

    expect(subscriptions).toEqual(['analysis_completed', 'analysis_failed', 'analysis_timeout'])
    await app.close()
  })

  it('rejects an analysis event whose payload does not have the expected shape', async () => {
    const handlers = new Map<string, EventHandler>()
    const app = buildApp({ logger: createLogger({ level: 'silent', pretty: false }) })
    const warn = vi.spyOn(app.log, 'warn')
    const deps = createDependencies([], handlers)
    const findById = vi.spyOn(deps.prisma.session, 'findUnique')

    await registerSessionsModule(app, deps)
    await handlers.get('analysis_completed')?.({
      eventId: 'evt-1',
      eventName: 'analysis_completed',
      occurredAt: new Date(),
      version: 1,
      payload: { sessionId: 'session-1' },
    })

    expect(findById).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      { eventId: 'evt-1', eventName: 'analysis_completed' },
      'analysis_event_payload_rejected',
    )
    await app.close()
  })

  it('hands a well-formed analysis event to its handler', async () => {
    const handlers = new Map<string, EventHandler>()
    const app = buildApp({ logger: createLogger({ level: 'silent', pretty: false }) })
    const deps = createDependencies([], handlers)
    const findById = vi.spyOn(deps.prisma.session, 'findUnique')

    await registerSessionsModule(app, deps)
    await handlers.get('analysis_completed')?.({
      eventId: 'evt-1',
      eventName: 'analysis_completed',
      occurredAt: new Date(),
      version: 1,
      payload: { sessionId: 'session-1', scores: { total: 80 } },
    })

    expect(findById).toHaveBeenCalledOnce()
    await app.close()
  })
})

function createDependencies(
  subscriptions: string[],
  handlers = new Map<string, EventHandler>(),
): SessionsModuleDeps {
  return {
    prisma: {
      session: {
        findUnique: () => Promise.resolve(null),
        findFirst: () => Promise.resolve(null),
        findMany: () => Promise.resolve([]),
        upsert: () => Promise.resolve(createSessionRow()),
        updateMany: () => Promise.resolve({ count: 1 }),
      },
      $transaction: async (operation) => operation(createDependencies(subscriptions).prisma),
    },
    clock: { now: () => new Date() },
    idGenerator: { generate: () => 'id' },
    eventPublisher: { publish: () => Promise.resolve() },
    eventSubscriber: {
      subscribe: (eventName, handler) => {
        subscriptions.push(eventName)
        handlers.set(eventName, handler)
      },
    },
    adapters: {
      accounts: {
        resolveAccountId: () => Promise.resolve(null),
        findProfile: () => Promise.resolve(null),
      },
      themes: {
        drawEligibleTheme: () => Promise.resolve(null),
        findThemeById: () => Promise.resolve({ themeId: 'theme-1', title: 'Theme' }),
        listCategories: () => Promise.resolve([]),
      },
      quota: {
        readBalance: () => Promise.resolve({ enforced: false }),
        reserveForSession: () =>
          Promise.resolve({ reservationId: 'id', enforced: true, remaining: 0 }),
        releaseReservation: () => Promise.resolve(),
      },
      audioStorage: {
        createUploadUrl: () => Promise.resolve({ uploadUrl: 'memory://upload', token: 'token' }),
        createDownloadUrl: () => Promise.resolve('memory://download'),
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
