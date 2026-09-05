import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  createSessionsIntegrationContainer,
  type SessionsIntegrationContainer,
} from '@/modules/sessions/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearSessionsData,
} from '@/modules/sessions/composition/integration-fixtures.js'

const ACCOUNT_A = '00000000-0000-4000-8000-000000000031'
const ACCOUNT_B = '00000000-0000-4000-8000-000000000032'
const THEME_ID = '00000000-0000-4000-8000-000000000033'
const RLS_TABLES = ['sessions', 'session_audios']
let harness: SessionsIntegrationContainer

async function startForA(): Promise<string> {
  const response = await harness.app.inject({
    method: 'POST',
    url: '/sessions',
    headers: { authorization: 'Bearer account-a' },
    payload: { difficulty: 'hard', categorySlug: 'privacy', searchWindowMinutes: 5 },
  })
  expect(response.statusCode).toBe(201)
  return response.json<{ data: { readonly sessionId: string } }>().data.sessionId
}

beforeAll(async () => {
  harness = await createSessionsIntegrationContainer({ databaseUrl: inject('databaseUrl') })
})
afterAll(async () => {
  await harness.close()
})
beforeEach(async () => {
  await clearSessionsData(harness.prisma)
  harness.reset()
  harness.accounts.registerIdentity('account-a', ACCOUNT_A)
  harness.accounts.registerIdentity('account-b', ACCOUNT_B)
  harness.themes.registerEligibleTheme({
    categorySlug: 'privacy',
    difficulty: 'hard',
    themeId: THEME_ID,
  })
})

describe('session isolation integration', () => {
  it('does not expose account A active session to account B and returns not found for every session mutation', async () => {
    const sessionId = await startForA()
    const active = await harness.app.inject({
      method: 'GET',
      url: '/sessions/active',
      headers: { authorization: 'Bearer account-b' },
    })
    expect(active.statusCode).toBe(200)
    expect(active.json()).toEqual({ data: null })
    for (const suffix of [
      'audio/upload-url',
      'audio/confirm',
      'abandon',
      'microphone-permission-denied',
    ]) {
      const response = await harness.app.inject({
        method: 'POST',
        url: `/sessions/${sessionId}/${suffix}`,
        headers: { authorization: 'Bearer account-b' },
      })
      expect(response.statusCode).toBe(404)
      assertResponseMatchesSchema(
        harness.app,
        'POST',
        `/sessions/{sessionId}/${suffix}`,
        response,
        404,
      )
      expect(response.json()).toMatchObject({ error: { code: 'sessions.SESSION_NOT_FOUND' } })
    }
    await expect(
      harness.prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toMatchObject({ accountId: ACCOUNT_A, state: 'in_progress' })
    expect(harness.eventBus.published).toHaveLength(1)
  })

  it('keeps row level security enabled without policies on session tables', async () => {
    const tableList = RLS_TABLES.map((table) => `'${table}'`).join(', ')
    const rows = await harness.prisma.$queryRawUnsafe<
      Array<{ readonly relrowsecurity: boolean; readonly relforcerowsecurity: boolean }>
    >(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN (${tableList})`)
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row).toEqual({ relrowsecurity: true, relforcerowsecurity: false })
    }
    const policies = await harness.prisma.$queryRawUnsafe<Array<{ readonly count: number }>>(
      `SELECT count(*)::int AS count FROM pg_policies WHERE tablename IN (${tableList})`,
    )
    expect(policies[0]?.count).toBe(0)
  })

  it('grants the data api roles no privilege on any table in public', async () => {
    const grants = await harness.prisma.$queryRawUnsafe<Array<{ readonly count: number }>>(
      `SELECT count(*)::int AS count
         FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND grantee IN ('anon', 'authenticated')`,
    )

    expect(grants[0]?.count).toBe(0)
  })

  it('leaves the data api roles out of the default privileges of public', async () => {
    const defaults = await harness.prisma.$queryRawUnsafe<Array<{ readonly grantee: string }>>(
      `SELECT (aclexplode(d.defaclacl)).grantee::regrole::text AS grantee
         FROM pg_default_acl d
         JOIN pg_namespace n ON n.oid = d.defaclnamespace
        WHERE n.nspname = 'public'`,
    )

    expect(defaults.map((row) => row.grantee)).not.toContain('anon')
    expect(defaults.map((row) => row.grantee)).not.toContain('authenticated')
  })

  it('enforces one in-progress session per account at the database level', async () => {
    const indexes = await harness.prisma.$queryRawUnsafe<Array<{ readonly indexdef: string }>>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'sessions' AND indexname = 'sessions_account_id_active_key'`,
    )

    expect(indexes).toHaveLength(1)
    expect(indexes[0]?.indexdef).toContain('UNIQUE')
    expect(indexes[0]?.indexdef).toContain("state = 'in_progress'")
  })
})
