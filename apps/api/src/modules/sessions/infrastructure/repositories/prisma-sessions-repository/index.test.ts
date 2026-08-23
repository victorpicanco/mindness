import { describe, expect, it } from 'vitest'

import { DatabaseError } from '@/shared/errors/database-error/index.js'
import type {
  SessionDeleteArgs,
  SessionFindActiveArgs,
  SessionFindManyArgs,
  SessionRow,
  SessionsPrismaClient,
  SessionUpsertArgs,
} from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'
import { SessionsTransactionContext } from '@/modules/sessions/infrastructure/clients/sessions-transaction-context/index.js'
import { SessionAudioMapper } from '@/modules/sessions/infrastructure/mappers/session-audio-mapper/index.js'
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
  recordedAt: null,
  audio: null,
}

interface FakeClient {
  readonly client: SessionsPrismaClient
  readonly activeQueries: SessionFindActiveArgs[]
  readonly findManyQueries: SessionFindManyArgs[]
  readonly upserts: SessionUpsertArgs[]
  readonly deletions: SessionDeleteArgs[]
}

function createFakeClient(
  options: {
    active?: SessionRow | null
    findMany?: SessionRow[]
    findManyError?: Error
    deletedCount?: number
    updateManyError?: Error
  } = {},
): FakeClient {
  const activeQueries: SessionFindActiveArgs[] = []
  const findManyQueries: SessionFindManyArgs[] = []
  const upserts: SessionUpsertArgs[] = []
  const deletions: SessionDeleteArgs[] = []

  return {
    activeQueries,
    findManyQueries,
    upserts,
    deletions,
    client: {
      session: {
        findUnique: () => Promise.resolve(null),
        findFirst: (args) => {
          activeQueries.push(args)
          return Promise.resolve(options.active ?? null)
        },
        findMany: (args) => {
          findManyQueries.push(args)
          if (options.findManyError !== undefined) return Promise.reject(options.findManyError)
          return Promise.resolve(options.findMany ?? [])
        },
        upsert: (args) => {
          upserts.push(args)
          return Promise.resolve(row)
        },
        updateMany: (args) => {
          deletions.push(args)
          if (options.updateManyError !== undefined) return Promise.reject(options.updateManyError)
          return Promise.resolve({ count: options.deletedCount ?? 1 })
        },
      },
    },
  }
}

function createRepository(fake: FakeClient): PrismaSessionsRepository {
  return new PrismaSessionsRepository(
    fake.client,
    new SessionsTransactionContext(),
    new SessionMapper(new SessionAudioMapper()),
  )
}

describe('PrismaSessionsRepository', () => {
  it('marks a session deleted only while it is still visible, and reports whether it won', async () => {
    const deletedAt = new Date('2026-08-22T12:00:00.000Z')
    const session = new SessionMapper(new SessionAudioMapper()).toDomain({
      ...row,
      state: 'completed',
      totalScore: 80,
      completedAt: new Date('2026-08-19T12:10:00.000Z'),
    })
    session.delete(deletedAt)

    const winner = createFakeClient({ deletedCount: 1 })
    await expect(createRepository(winner).markDeleted(session)).resolves.toBe(true)
    expect(winner.deletions).toEqual([
      {
        where: { id: row.id, state: { not: 'deleted' } },
        data: { state: 'deleted', deletedAt },
      },
    ])

    const loser = createFakeClient({ deletedCount: 0 })
    await expect(createRepository(loser).markDeleted(session)).resolves.toBe(false)
  })

  it('translates a failure to mark the deletion into a database error', async () => {
    const session = new SessionMapper(new SessionAudioMapper()).toDomain({
      ...row,
      state: 'completed',
      totalScore: 80,
      completedAt: new Date('2026-08-19T12:10:00.000Z'),
    })
    session.delete(new Date('2026-08-22T12:00:00.000Z'))
    const fake = createFakeClient({ updateManyError: new DatabaseError('boom') })

    await expect(createRepository(fake).markDeleted(session)).rejects.toBeInstanceOf(DatabaseError)
  })

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
    const fake = createFakeClient({ findMany: [row] })
    const repository = createRepository(fake)

    await expect(repository.findExpiredInProgress(before, 20)).resolves.toHaveLength(1)
    expect(fake.findManyQueries).toEqual([
      {
        where: { state: 'in_progress', expiresAt: { lte: before } },
        include: { audio: true },
        take: 20,
      },
    ])
  })

  it('finds processing sessions stuck without a recent recording within the requested batch size', async () => {
    const before = new Date('2026-08-19T12:15:00.000Z')
    const fake = createFakeClient({ findMany: [row] })
    const repository = createRepository(fake)

    await expect(repository.findStuckProcessing(before, 20)).resolves.toHaveLength(1)
    expect(fake.findManyQueries).toEqual([
      {
        where: { state: 'processing', recordedAt: { lte: before } },
        include: { audio: true },
        take: 20,
      },
    ])
  })

  it('lists non-deleted sessions by account with the requested cursor page', async () => {
    const fake = createFakeClient({ findMany: [row] })
    const repository = createRepository(fake)

    await expect(
      repository.listByAccount({ accountId: row.accountId, limit: 21, cursor: null }),
    ).resolves.toMatchObject([{ id: row.id }])
    expect(fake.findManyQueries).toEqual([
      {
        where: { accountId: row.accountId, state: { not: 'deleted' } },
        include: { audio: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 21,
      },
    ])

    await expect(
      repository.listByAccount({ accountId: row.accountId, limit: 21, cursor: row.id }),
    ).resolves.toMatchObject([{ id: row.id }])
    expect(fake.findManyQueries[1]).toEqual({
      where: { accountId: row.accountId, state: { not: 'deleted' } },
      include: { audio: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      cursor: { id: row.id },
      skip: 1,
    })
  })

  it('translates a paginated history lookup failure into a database error', async () => {
    const fake = createFakeClient({
      findManyError: new DatabaseError('Database unavailable', { context: {} }),
    })
    const repository = createRepository(fake)

    await expect(
      repository.listByAccount({ accountId: row.accountId, limit: 21, cursor: null }),
    ).rejects.toBeInstanceOf(DatabaseError)
  })

  it('finds completed sessions inside a time window without applying pagination', async () => {
    const from = new Date('2026-08-19T00:00:00.000Z')
    const to = new Date('2026-08-20T00:00:00.000Z')
    const fake = createFakeClient({ findMany: [{ ...row, state: 'completed' }] })
    const repository = createRepository(fake)

    await expect(repository.findCompletedBetween(row.accountId, from, to)).resolves.toMatchObject([
      { id: row.id, state: 'completed' },
    ])
    expect(fake.findManyQueries).toEqual([
      {
        where: {
          accountId: row.accountId,
          state: 'completed',
          createdAt: { gte: from, lte: to },
        },
        include: { audio: true },
      },
    ])
  })

  it('returns no sessions when the completed time window is empty', async () => {
    const repository = createRepository(createFakeClient())

    await expect(
      repository.findCompletedBetween(
        row.accountId,
        new Date('2026-08-19T00:00:00.000Z'),
        new Date('2026-08-20T00:00:00.000Z'),
      ),
    ).resolves.toEqual([])
  })

  it('translates a completed time window lookup failure into a database error', async () => {
    const fake = createFakeClient({
      findManyError: new DatabaseError('Database unavailable', { context: {} }),
    })
    const repository = createRepository(fake)

    await expect(
      repository.findCompletedBetween(
        row.accountId,
        new Date('2026-08-19T00:00:00.000Z'),
        new Date('2026-08-20T00:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(DatabaseError)
  })

  it('persists a session and its accepted audio in one upsert', async () => {
    const fake = createFakeClient()
    const repository = createRepository(fake)
    const mapper = new SessionMapper(new SessionAudioMapper())
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
