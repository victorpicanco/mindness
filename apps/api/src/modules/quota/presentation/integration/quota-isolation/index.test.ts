import Fastify from 'fastify'
import pino from 'pino'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  createQuotaIntegrationContainer,
  type QuotaIntegrationContainer,
} from '@/modules/quota/composition/integration-container.js'
import {
  clearQuotaData,
  createQuotaAccountFixture,
} from '@/modules/quota/composition/integration-fixtures.js'
import { registerQuotaModule } from '@/modules/quota/index.js'
import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'

const RLS_TABLES = ['quota_cycles', 'quota_reservations', 'accounts', 'account_deletion_requests']
const PROBE_ROLE = 'quota_isolation_probe'

interface PgClassRow {
  readonly relname: string
  readonly relrowsecurity: boolean
  readonly relforcerowsecurity: boolean
}

let harness: QuotaIntegrationContainer

beforeAll(() => {
  harness = createQuotaIntegrationContainer({ databaseUrl: inject('databaseUrl') })
})

afterAll(async () => {
  await harness.close()
})

beforeEach(async () => {
  await clearQuotaData(harness.prisma)
  harness.reset()
})

describe('quota isolation integration', () => {
  it('does not expose the quota through an HTTP route', async () => {
    const app = buildApp({ logger: pino({ level: 'silent' }) })

    registerQuotaModule(app, {
      prisma: harness.prisma,
      clock: harness.clock,
      idGenerator: { generate: () => 'event-id' },
      eventPublisher: harness.eventBus,
      accountsFacade: { getAccountSnapshot: () => Promise.resolve(null) },
    })
    await app.ready()

    const response = await app.inject({ method: 'GET', url: '/quota' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      message: 'Route GET:/quota not found',
      error: 'Not Found',
      statusCode: 404,
    })
    await app.close()
  })

  // Probing one guessed URL only proves that URL is unrouted. LAW-011.13 asks every response
  // to match its route's schema; this module answers by having no route to declare one for, so
  // that absence is what gets asserted.
  it('registers no HTTP route when it is mounted on the application', async () => {
    const app = buildApp({ logger: pino({ level: 'silent' }) })
    const registeredRoutes: string[] = []
    app.addHook('onRoute', (route) => {
      registeredRoutes.push(`${String(route.method)} ${route.url}`)
    })

    registerQuotaModule(app, {
      prisma: harness.prisma,
      clock: harness.clock,
      idGenerator: { generate: () => 'event-id' },
      eventPublisher: harness.eventBus,
      accountsFacade: { getAccountSnapshot: () => Promise.resolve(null) },
    })
    await app.ready()

    expect(registeredRoutes).toEqual([])
    await app.close()
  })

  it('does not replace the application error handler', async () => {
    const app = Fastify({ logger: false })
    app.setErrorHandler((_error, _request, reply) => {
      reply.status(418).send({ preserved: true })
    })
    app.get('/handler-probe', () => {
      throw new ValidationFailedError([])
    })

    registerQuotaModule(app, {
      prisma: harness.prisma,
      clock: harness.clock,
      idGenerator: { generate: () => 'event-id' },
      eventPublisher: harness.eventBus,
      accountsFacade: { getAccountSnapshot: () => Promise.resolve(null) },
    })
    await app.ready()

    const response = await app.inject({ method: 'GET', url: '/handler-probe' })

    expect(response.statusCode).toBe(418)
    expect(response.json()).toEqual({ preserved: true })
    await app.close()
  })

  // Exceção declarada a LAW-011.12: o objeto sob teste é o catálogo do PostgreSQL, que
  // não tem repositório possível.
  it('keeps row level security enabled without any policy on the exposed tables', async () => {
    const tableList = RLS_TABLES.map((table) => `'${table}'`).join(', ')

    const classRows = await harness.prisma.$queryRawUnsafe<PgClassRow[]>(
      `SELECT relname, relrowsecurity, relforcerowsecurity
       FROM pg_class
       WHERE relname IN (${tableList})
       ORDER BY relname`,
    )

    expect(classRows).toHaveLength(RLS_TABLES.length)
    for (const row of classRows) {
      expect(row.relrowsecurity).toBe(true)
      expect(row.relforcerowsecurity).toBe(false)
    }

    const policyRows = await harness.prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT count(*)::int AS count FROM pg_policies WHERE tablename IN (${tableList})`,
    )

    expect(policyRows[0]?.count).toBe(0)
  })

  // Exceção declarada a LAW-011.12: o objeto sob teste é a identidade do papel conectado,
  // que não tem repositório possível.
  it('denies a non-owner role read and write access to persisted quota data', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)
    await harness.container.publicApi.reserveForSession({
      accountId: account.accountId,
      sessionId: 'isolation-probe-session',
    })

    await harness.prisma.$executeRawUnsafe(`CREATE ROLE ${PROBE_ROLE} NOLOGIN`)
    await harness.prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${PROBE_ROLE}`)
    await harness.prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON quota_cycles, quota_reservations TO ${PROBE_ROLE}`,
    )

    try {
      const { selectedRows, updatedCount } = await harness.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${PROBE_ROLE}`)
        const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          'SELECT id FROM quota_reservations',
        )
        const affected = await tx.$executeRawUnsafe(
          "UPDATE quota_reservations SET status = 'released' WHERE session_id = 'isolation-probe-session'",
        )

        return { selectedRows: rows, updatedCount: affected }
      })

      expect(selectedRows).toHaveLength(0)
      expect(updatedCount).toBe(0)
    } finally {
      await harness.prisma.$executeRawUnsafe(`DROP OWNED BY ${PROBE_ROLE}`)
      await harness.prisma.$executeRawUnsafe(`DROP ROLE ${PROBE_ROLE}`)
    }

    await expect(
      harness.prisma.quotaReservation.findFirst({
        where: { sessionId: 'isolation-probe-session' },
      }),
    ).resolves.toMatchObject({ status: 'held' })
  })
})
