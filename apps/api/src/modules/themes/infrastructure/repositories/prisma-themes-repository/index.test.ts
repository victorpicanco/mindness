import { describe, expect, it } from 'vitest'

import { Prisma } from '@/generated/prisma/client.js'
import { ThemeTitleAlreadyUsedError } from '@/modules/themes/domain/errors/theme-title-already-used-error/index.js'
import type {
  ThemeRow,
  ThemesPrismaClient,
  ThemeUpsertArgs,
} from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'
import { ThemeMapper } from '@/modules/themes/infrastructure/mappers/theme-mapper/index.js'

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
}

interface FakeClient {
  readonly client: ThemesPrismaClient
  readonly upserts: ThemeUpsertArgs[]
}

function createFakeClient(options: FakeClientOptions = {}): FakeClient {
  const upserts: ThemeUpsertArgs[] = []

  return {
    upserts,
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
        findMany: () => Promise.resolve([]),
      },
      themeCategory: {
        findUnique: () => Promise.resolve(null),
        upsert: (args) => Promise.resolve(args.create),
        findMany: () => Promise.resolve([]),
      },
      $queryRaw: () => Promise.resolve([]),
    },
  }
}

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.9.1',
  })
}

function createRepository(fake: FakeClient): PrismaThemesRepository {
  return new PrismaThemesRepository(fake.client, new ThemeMapper())
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
})
