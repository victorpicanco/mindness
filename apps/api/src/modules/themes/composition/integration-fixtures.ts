import type { PrismaClient } from '@/generated/prisma/client.js'
import type { CreateThemeCategoryInput } from '@/modules/themes/application/use-cases/create-theme-category/index.js'
import type { CreateThemeInput } from '@/modules/themes/application/use-cases/create-theme/index.js'

const THEME_TABLES = ['themes', 'theme_categories']

export interface ThemeCategoryFixtureOverrides {
  readonly slug?: string
  readonly name?: string
}

export interface ThemeFixtureOverrides {
  readonly title?: string
  readonly categorySlug?: string
  readonly difficulty?: CreateThemeInput['difficulty']
}

export function clearThemeData(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${THEME_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  )
}

export function createThemeCategoryFixture(
  overrides: ThemeCategoryFixtureOverrides = {},
): CreateThemeCategoryInput {
  return {
    slug: overrides.slug ?? 'mindfulness',
    name: overrides.name ?? 'Mindfulness',
  }
}

export function createThemeFixture(overrides: ThemeFixtureOverrides = {}): CreateThemeInput {
  return {
    title: overrides.title ?? 'Notice your breathing',
    categorySlug: overrides.categorySlug ?? 'mindfulness',
    difficulty: overrides.difficulty ?? 'easy',
  }
}
