import { describe, expect, it } from 'vitest'

import { Prisma } from '@/generated/prisma/client.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'
import { ThemeTitleAlreadyUsedError } from '@/modules/themes/domain/errors/theme-title-already-used-error/index.js'
import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'
import type {
  ThemeRow,
  ThemesPrismaClient,
  ThemeUpsertArgs,
} from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'
import { ThemeMapper } from '@/modules/themes/infrastructure/mappers/theme-mapper/index.js'
import { ThemesTransactionContext } from '@/modules/themes/infrastructure/clients/themes-transaction-context/index.js'

import { PrismaThemesRepository } from './index.js'

const row: ThemeRow = {
  id: '1d3e3f45-8bb3-48ca-a721-71276ed4f1f3',
  categoryId: '8526a22f-5ed3-4783-8b99-7536436bf0cf',
  title: 'Climate Change',
  normalizedTitle: 'climate change',
  difficulty: 'balanced',
  publicationStatus: 'withdrawn',
  createdAt: new Date('2026-08-16T00:00:00.000Z'),
}

interface FakeClientOptions {
  readonly row?: ThemeRow
  readonly writeFailure?: Prisma.PrismaClientKnownRequestError
  readonly rawResult?: unknown
  readonly combinations?: ThemeRow[]
  readonly rows?: ThemeRow[]
  readonly readFailure?: DatabaseError
}

interface FakeClient {
  readonly client: ThemesPrismaClient
  readonly upserts: ThemeUpsertArgs[]
  readonly idQueries: (readonly string[])[]
}

function createFindMany(
  options: FakeClientOptions,
  idQueries: (readonly string[])[],
): ThemesPrismaClient['theme']['findMany'] {
  return (args) => {
    if (!('id' in args.where)) return Promise.resolve(options.combinations ?? [])
    if (options.readFailure !== undefined) return Promise.reject(options.readFailure)

    idQueries.push(args.where.id.in)

    return Promise.resolve(options.rows ?? [])
  }
}

function createFakeClient(options: FakeClientOptions = {}): FakeClient {
  const upserts: ThemeUpsertArgs[] = []
  const idQueries: (readonly string[])[] = []

  return {
    upserts,
    idQueries,
    client: {
      theme: {
        findUnique: () => Promise.resolve(options.row ?? null),
        findFirst: () => Promise.resolve(null),
        upsert: (args) => {
          if (options.writeFailure !== undefined) return Promise.reject(options.writeFailure)
          upserts.push(args)
          return Promise.resolve(args.create)
        },
        count: () => Promise.resolve(0),
        findMany: createFindMany(options, idQueries),
      },
      themeCategory: {
        findUnique: () => Promise.resolve(null),
        upsert: (args) => Promise.resolve(args.create),
        findMany: () => Promise.resolve([]),
      },
      $queryRaw: () => Promise.resolve(options.rawResult ?? []),
    },
  }
}

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.9.1',
    meta: { target: ['category_id', 'normalized_title'] },
  })
}

function createRepository(fake: FakeClient): PrismaThemesRepository {
  return new PrismaThemesRepository(fake.client, new ThemesTransactionContext(), new ThemeMapper())
}

describe('PrismaThemesRepository', () => {
  it('translates a composite unique violation and preserves its cause', async () => {
    const failure = uniqueViolation()
    const repository = createRepository(createFakeClient({ writeFailure: failure }))
    const theme = new ThemeMapper().toDomain(row)

    await expect(repository.save(theme)).rejects.toBeInstanceOf(ThemeTitleAlreadyUsedError)
    await expect(repository.save(theme)).rejects.toMatchObject({
      cause: failure,
      context: { categoryId: row.categoryId, normalizedTitle: row.normalizedTitle },
    })
  })

  it('returns a withdrawn theme by identifier', async () => {
    const repository = createRepository(createFakeClient({ row }))

    await expect(repository.findById(row.id)).resolves.toMatchObject({
      id: row.id,
      publicationStatus: 'withdrawn',
    })
  })

  it('preserves domain validation errors raised while mapping a persisted row', async () => {
    const repository = createRepository(createFakeClient({ row: { ...row, title: 'No' } }))

    await expect(repository.findById(row.id)).rejects.toBeInstanceOf(InvalidThemeValueError)
  })

  it('does not mislabel a primary-key unique violation as a title conflict', async () => {
    const failure = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.9.1',
      meta: { target: ['id'] },
    })
    const repository = createRepository(createFakeClient({ writeFailure: failure }))
    const theme = new ThemeMapper().toDomain(row)

    await expect(repository.save(theme)).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      cause: failure,
    })
  })

  it('rejects a raw result that is not a persisted theme row', async () => {
    const repository = createRepository(createFakeClient({ rawResult: [{ id: row.id }] }))

    await expect(
      repository.drawPublished({ categoryId: row.categoryId, difficulty: row.difficulty }),
    ).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      message: 'Received an invalid published theme row from the database',
      cause: undefined,
      context: { categoryId: row.categoryId, difficulty: row.difficulty },
    })
  })

  it('maps every row returned for a batch of theme identifiers', async () => {
    const other: ThemeRow = {
      ...row,
      id: 'a2b1e0a4-6c1d-4f0e-9a2b-5f0d3c8e7b61',
      title: 'Housing Crisis',
      normalizedTitle: 'housing crisis',
    }
    const fake = createFakeClient({ rows: [row, other] })
    const repository = createRepository(fake)

    await expect(repository.listByIds([row.id, other.id])).resolves.toMatchObject([
      { id: row.id, title: { value: 'Climate Change' } },
      { id: other.id, title: { value: 'Housing Crisis' } },
    ])
    expect(fake.idQueries).toEqual([[row.id, other.id]])
  })

  it('resolves an empty batch without reaching the database', async () => {
    const fake = createFakeClient({ rows: [row] })
    const repository = createRepository(fake)

    await expect(repository.listByIds([])).resolves.toEqual([])
    expect(fake.idQueries).toEqual([])
  })

  it('translates a failure raised while reading a batch of themes', async () => {
    const failure = new DatabaseError('connection lost')
    const repository = createRepository(createFakeClient({ readFailure: failure }))

    await expect(repository.listByIds([row.id])).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      cause: failure,
      context: { themeIds: [row.id] },
    })
  })

  it('projects the published combinations out of the rows it reads', async () => {
    const repository = createRepository(createFakeClient({ combinations: [row] }))

    const combinations = await repository.listPublishedCombinations()

    expect(combinations).toEqual([{ categoryId: row.categoryId, difficulty: row.difficulty }])
  })
})
