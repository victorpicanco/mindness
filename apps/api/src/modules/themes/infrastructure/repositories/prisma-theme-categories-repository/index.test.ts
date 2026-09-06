import { describe, expect, it } from 'vitest'

import { Prisma } from '@/generated/prisma/client.js'
import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import type {
  ThemeCategoryRow,
  ThemeRow,
  ThemesPrismaClient,
} from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'
import { ThemeCategoryMapper } from '@/modules/themes/infrastructure/mappers/theme-category-mapper/index.js'
import { ThemesTransactionContext } from '@/modules/themes/infrastructure/clients/themes-transaction-context/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'

import { PrismaThemeCategoriesRepository } from './index.js'

function categorySlugUniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.9.1',
    meta: { target: ['slug'] },
  })
}

interface FakeCategoryClient {
  readonly client: ThemesPrismaClient
  readonly slugQueries: (readonly string[])[]
  readonly executions: Prisma.Sql[]
}

function createClient(options: {
  readonly failure?: Prisma.PrismaClientKnownRequestError
  readonly rows?: ThemeCategoryRow[]
}): FakeCategoryClient {
  const theme: ThemeRow = {
    id: '1d3e3f45-8bb3-48ca-a721-71276ed4f1f3',
    categoryId: '8526a22f-5ed3-4783-8b99-7536436bf0cf',
    title: 'Climate Change',
    normalizedTitle: 'climate change',
    difficulty: 'balanced',
    publicationStatus: 'draft',
    createdAt: new Date('2026-08-16T00:00:00.000Z'),
  }

  const slugQueries: (readonly string[])[] = []
  const executions: Prisma.Sql[] = []

  return {
    slugQueries,
    executions,
    client: {
      theme: {
        findUnique: () => Promise.resolve(null),
        findFirst: () => Promise.resolve(null),
        upsert: () => Promise.resolve(theme),
        count: () => Promise.resolve(0),
        findMany: () => Promise.resolve([]),
      },
      themeCategory: {
        findUnique: () => Promise.resolve(null),
        upsert: (args) =>
          options.failure === undefined
            ? Promise.resolve(args.create)
            : Promise.reject(options.failure),
        findMany: (args) => {
          if ('slug' in args.where) slugQueries.push(args.where.slug.in)
          return Promise.resolve(options.rows ?? [])
        },
      },
      $queryRaw: () => Promise.resolve([]),
      $executeRaw: (query) => {
        executions.push(query)
        return Promise.resolve(1)
      },
    },
  }
}

describe('PrismaThemeCategoriesRepository', () => {
  it('loads the requested category slugs with one query', async () => {
    const row: ThemeCategoryRow = {
      id: '8526a22f-5ed3-4783-8b99-7536436bf0cf',
      slug: 'mindfulness',
      name: 'Mindfulness',
    }
    const fake = createClient({ rows: [row] })
    const repository = new PrismaThemeCategoriesRepository(
      fake.client,
      new ThemesTransactionContext(),
      new ThemeCategoryMapper(),
    )

    await expect(repository.listBySlugs([row.slug])).resolves.toMatchObject([{ id: row.id }])
    expect(fake.slugQueries).toEqual([[row.slug]])
  })

  it('persists a category batch with one parameterized statement', async () => {
    const fake = createClient({})
    const repository = new PrismaThemeCategoriesRepository(
      fake.client,
      new ThemesTransactionContext(),
      new ThemeCategoryMapper(),
    )
    const category = ThemeCategory.create({
      id: '8526a22f-5ed3-4783-8b99-7536436bf0cf',
      slug: CategorySlug.create('mindfulness'),
      name: 'Mindfulness',
    })

    await repository.saveMany([category, category])

    expect(fake.executions).toHaveLength(1)
    expect(fake.executions[0]?.sql).toContain('INSERT INTO "theme_categories"')
    expect(fake.executions[0]?.values).toHaveLength(6)
  })

  it('translates a slug unique violation and preserves its cause', async () => {
    const failure = categorySlugUniqueViolation()
    const repository = new PrismaThemeCategoriesRepository(
      createClient({ failure }).client,
      new ThemesTransactionContext(),
      new ThemeCategoryMapper(),
    )
    const category = ThemeCategory.create({
      id: '8526a22f-5ed3-4783-8b99-7536436bf0cf',
      slug: CategorySlug.create('mindfulness'),
      name: 'Mindfulness',
    })

    await expect(repository.save(category)).rejects.toMatchObject({
      code: 'themes.THEME_CATEGORY_SLUG_ALREADY_USED',
      cause: failure,
      context: { slug: 'mindfulness' },
    })
  })
})
