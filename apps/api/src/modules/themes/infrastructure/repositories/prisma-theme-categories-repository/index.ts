import type { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type { ThemesPrismaClient } from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'
import type { ThemeCategoryMapper } from '@/modules/themes/infrastructure/mappers/theme-category-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

const PUBLISHED_STATUS = 'published'

export class PrismaThemeCategoriesRepository implements ThemeCategoriesRepository {
  constructor(
    private readonly prisma: ThemesPrismaClient,
    private readonly mapper: ThemeCategoryMapper,
  ) {}

  async findById(categoryId: string): Promise<ThemeCategory | null> {
    try {
      const row = await this.prisma.themeCategory.findUnique({ where: { id: categoryId } })

      return row === null ? null : this.mapper.toDomain(row)
    } catch (error) {
      throw new DatabaseError('Failed to read the theme category', {
        cause: error,
        context: { categoryId },
      })
    }
  }

  async findBySlug(slug: string): Promise<ThemeCategory | null> {
    try {
      const row = await this.prisma.themeCategory.findUnique({ where: { slug } })

      return row === null ? null : this.mapper.toDomain(row)
    } catch (error) {
      throw new DatabaseError('Failed to read the theme category', {
        cause: error,
        context: { slug },
      })
    }
  }

  async save(category: ThemeCategory): Promise<void> {
    const row = this.mapper.toPersistence(category)

    try {
      await this.prisma.themeCategory.upsert({ where: { id: row.id }, create: row, update: row })
    } catch (error) {
      throw new DatabaseError('Failed to save the theme category', {
        cause: error,
        context: { categoryId: row.id },
      })
    }
  }

  async listWithPublishedThemes(): Promise<ThemeCategory[]> {
    try {
      const rows = await this.prisma.themeCategory.findMany({
        where: { themes: { some: { publicationStatus: PUBLISHED_STATUS } } },
      })

      return rows.map((row) => this.mapper.toDomain(row))
    } catch (error) {
      throw new DatabaseError('Failed to list theme categories', { cause: error })
    }
  }
}
