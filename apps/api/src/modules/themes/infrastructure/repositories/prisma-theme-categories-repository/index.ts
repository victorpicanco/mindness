import { Prisma } from '@/generated/prisma/client.js'
import type { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { ThemeCategorySlugAlreadyUsedError } from '@/modules/themes/domain/errors/theme-category-slug-already-used-error/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type { ThemesPrismaClient } from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'
import type { ThemesTransactionContext } from '@/modules/themes/infrastructure/clients/themes-transaction-context/index.js'
import type { ThemeCategoryMapper } from '@/modules/themes/infrastructure/mappers/theme-category-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

const PUBLISHED_STATUS = 'published'
const UNIQUE_VIOLATION_CODE = 'P2002'

function isSlugUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== UNIQUE_VIOLATION_CODE
  ) {
    return false
  }

  const target = error.meta?.target
  return Array.isArray(target) && target.length === 1 && target[0] === 'slug'
}

export class PrismaThemeCategoriesRepository implements ThemeCategoriesRepository {
  constructor(
    private readonly prisma: ThemesPrismaClient,
    private readonly transactionContext: ThemesTransactionContext,
    private readonly mapper: ThemeCategoryMapper,
  ) {}

  async findById(categoryId: string): Promise<ThemeCategory | null> {
    let row
    try {
      row = await this.client().themeCategory.findUnique({ where: { id: categoryId } })
    } catch (error) {
      throw new DatabaseError('Failed to read the theme category', {
        cause: error,
        context: { categoryId },
      })
    }

    return row === null ? null : this.mapper.toDomain(row)
  }

  async findBySlug(slug: string): Promise<ThemeCategory | null> {
    let row
    try {
      row = await this.client().themeCategory.findUnique({ where: { slug } })
    } catch (error) {
      throw new DatabaseError('Failed to read the theme category', {
        cause: error,
        context: { slug },
      })
    }

    return row === null ? null : this.mapper.toDomain(row)
  }

  async listBySlugs(slugs: readonly string[]): Promise<ThemeCategory[]> {
    if (slugs.length === 0) return []

    let rows
    try {
      rows = await this.client().themeCategory.findMany({ where: { slug: { in: [...slugs] } } })
    } catch (error) {
      throw new DatabaseError('Failed to read theme categories by slug', {
        cause: error,
        context: { slugs: [...slugs] },
      })
    }

    return rows.map((row) => this.mapper.toDomain(row))
  }

  async save(category: ThemeCategory): Promise<void> {
    const row = this.mapper.toPersistence(category)

    try {
      await this.client().themeCategory.upsert({ where: { id: row.id }, create: row, update: row })
    } catch (error) {
      if (isSlugUniqueViolation(error)) {
        throw new ThemeCategorySlugAlreadyUsedError(row.slug, { cause: error })
      }

      throw new DatabaseError('Failed to save the theme category', {
        cause: error,
        context: { categoryId: row.id },
      })
    }
  }

  async saveMany(categories: readonly ThemeCategory[]): Promise<void> {
    if (categories.length === 0) return
    const values = categories.map((category) => {
      const row = this.mapper.toPersistence(category)
      return Prisma.sql`(${row.id}::uuid, ${row.slug}, ${row.name})`
    })

    try {
      await this.client().$executeRaw(
        Prisma.sql`
          INSERT INTO "theme_categories" ("id", "slug", "name")
          VALUES ${Prisma.join(values)}
          ON CONFLICT ("slug")
          DO UPDATE SET "name" = EXCLUDED."name"
        `,
      )
    } catch (error) {
      throw new DatabaseError('Failed to save the theme category catalog batch', {
        cause: error,
        context: { categoryCount: categories.length },
      })
    }
  }

  async listWithPublishedThemes(): Promise<ThemeCategory[]> {
    let rows
    try {
      rows = await this.client().themeCategory.findMany({
        where: { themes: { some: { publicationStatus: PUBLISHED_STATUS } } },
      })
    } catch (error) {
      throw new DatabaseError('Failed to list theme categories', { cause: error })
    }

    return rows.map((row) => this.mapper.toDomain(row))
  }

  private client(): ThemesPrismaClient {
    return this.transactionContext.current() ?? this.prisma
  }
}
