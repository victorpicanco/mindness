import { describe, expect, it } from 'vitest'

import type {
  SessionFindActiveArgs,
  SessionFindExpiredArgs,
  SessionRow,
  SessionsPrismaClient,
  SessionUpsertArgs,
} from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'
import { SessionsTransactionContext } from '@/modules/sessions/infrastructure/clients/sessions-transaction-context/index.js'
import { SessionMapper } from '@/modules/sessions/infrastructure/mappers/session-mapper/index.js'

import { PrismaSessionsRepository } from './index.js'

const row: SessionRow = {
  id: '6f3a143d-6853-48f0-b414-a57d8b65f101',
  accountId: '97784f56-9b46-44a4-a0d2-52e97d2fe201',
  themeId: 'c674e9e3-807e-4516-8471-43b0c392f701',
  difficulty: 'balanced',
  categorySlug: 'self-awareness',
  searchWindowMinutes: 4,
  quotaReservationId: '5ad7c104-4621-4a0f-906b-e5a2ca616601',
  state: 'in_progress',
  expiredReason: null,
  createdAt: new Date('2026-08-19T12:00:00.000Z'),
  expiresAt: new Date('2026-08-19T12:15:00.000Z'),
  expiredAt: null,
  audio: null,
}

interface FakeClient {
  readonly client: SessionsPrismaClient
  readonly activeQueries: SessionFindActiveArgs[]
  readonly expiredQueries: SessionFindExpiredArgs[]
  readonly upserts: SessionUpsertArgs[]
}

function createFakeClient(
  options: { active?: SessionRow | null; expired?: SessionRow[] } = {},
): FakeClient {
  const activeQueries: SessionFindActiveArgs[] = []
  const expiredQueries: SessionFindExpiredArgs[] = []
  const upserts: SessionUpsertArgs[] = []

  return {
    activeQueries,
    expiredQueries,
    upserts,
    client: {
      session: {
        findUnique: () => Promise.resolve(null),
        findFirst: (args) => {
          activeQueries.push(args)
          return Promise.resolve(options.active ?? null)
        },
        findMany: (args) => {
          expiredQueries.push(args)
          return Promise.resolve(options.expired ?? [])
        },
        upsert: (args) => {
          upserts.push(args)
          return Promise.resolve(row)
        },
      },
    },
  }
}

function createRepository(fake: FakeClient): PrismaSessionsRepository {
  return new PrismaSessionsRepository(
    fake.client,
    new SessionsTransactionContext(),
    new SessionMapper(),
  )
}

describe('PrismaSessionsRepository', () => {
  it('finds only an in-progress session for the account and returns null when absent', async () => {
    const fake = createFakeClient()
    const repository = createRepository(fake)

    await expect(repository.findActiveByAccountId(row.accountId)).resolves.toBeNull()
    expect(fake.activeQueries).toEqual([
      { where: { accountId: row.accountId, state: 'in_progress' }, include: { audio: true } },
    ])
  })

  it('finds expired in-progress sessions within the requested batch size', async () => {
    const before = new Date('2026-08-19T12:15:00.000Z')
    const fake = createFakeClient({ expired: [row] })
    const repository = createRepository(fake)

    await expect(repository.findExpiredInProgress(before, 20)).resolves.toHaveLength(1)
    expect(fake.expiredQueries).toEqual([
      {
        where: { state: 'in_progress', expiresAt: { lte: before } },
        include: { audio: true },
        take: 20,
      },
    ])
  })

  it('persists a session and its accepted audio in one upsert', async () => {
    const fake = createFakeClient()
    const repository = createRepository(fake)
    const mapper = new SessionMapper()
    const session = mapper.toDomain({
      ...row,
      state: 'processing',
      audio: {
        id: row.id,
        sessionId: row.id,
        durationSeconds: 42,
        sizeBytes: 1024,
        contentType: 'audio/webm',
        storagePath:
          '97784f56-9b46-44a4-a0d2-52e97d2fe201/6f3a143d-6853-48f0-b414-a57d8b65f101/audio',
        createdAt: row.createdAt,
      },
    })

    await expect(repository.save(session)).resolves.toBeUndefined()
    expect(fake.upserts).toHaveLength(1)
    expect(fake.upserts[0]?.create.audio).not.toBeNull()
    expect(fake.upserts[0]?.update.audio).not.toBeNull()
  })
})
