import { describe, expect, it } from 'vitest'

import { Prisma } from '@/generated/prisma/client.js'
import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import type {
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

function createClient(failure: Prisma.PrismaClientKnownRequestError): ThemesPrismaClient {
  const theme: ThemeRow = {
    id: '1d3e3f45-8bb3-48ca-a721-71276ed4f1f3',
    categoryId: '8526a22f-5ed3-4783-8b99-7536436bf0cf',
    title: 'Climate Change',
    normalizedTitle: 'climate change',
    difficulty: 'balanced',
    publicationStatus: 'draft',
    createdAt: new Date('2026-08-16T00:00:00.000Z'),
  }

  return {
    theme: {
      findUnique: () => Promise.resolve(null),
      findFirst: () => Promise.resolve(null),
      upsert: () => Promise.resolve(theme),
      count: () => Promise.resolve(0),
      findMany: () => Promise.resolve([]),
    },
    themeCategory: {
      findUnique: () => Promise.resolve(null),
      upsert: () => Promise.reject(failure),
      findMany: () => Promise.resolve([]),
    },
    $queryRaw: () => Promise.resolve([]),
  }
}

describe('PrismaThemeCategoriesRepository', () => {
  it('translates a slug unique violation and preserves its cause', async () => {
    const failure = categorySlugUniqueViolation()
    const repository = new PrismaThemeCategoriesRepository(
      createClient(failure),
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
