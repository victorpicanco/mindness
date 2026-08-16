import { Prisma } from '@/generated/prisma/client.js'
import type { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeTitleAlreadyUsedError } from '@/modules/themes/domain/errors/theme-title-already-used-error/index.js'
import type {
  ThemeCombination,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import type { ThemesPrismaClient } from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'
import type { ThemeMapper } from '@/modules/themes/infrastructure/mappers/theme-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

const UNIQUE_VIOLATION_CODE = 'P2002'
const PUBLISHED_STATUS = 'published'

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION_CODE
  )
}

export class PrismaThemesRepository implements ThemesRepository {
  constructor(
    private readonly prisma: ThemesPrismaClient,
    private readonly mapper: ThemeMapper,
  ) {}

  async findById(themeId: string): Promise<Theme | null> {
    try {
      const row = await this.prisma.theme.findUnique({ where: { id: themeId } })

      return row === null ? null : this.mapper.toDomain(row)
    } catch (error) {
      throw new DatabaseError('Failed to read the theme', { cause: error, context: { themeId } })
    }
  }

  async findByNormalizedTitle(params: {
    categoryId: string
    normalizedTitle: string
  }): Promise<Theme | null> {
    try {
      const row = await this.prisma.theme.findFirst({ where: params })

      return row === null ? null : this.mapper.toDomain(row)
    } catch (error) {
      throw new DatabaseError('Failed to read the theme', { cause: error, context: params })
    }
  }

  async save(theme: Theme): Promise<void> {
    const row = this.mapper.toPersistence(theme)

    try {
      await this.prisma.theme.upsert({ where: { id: row.id }, create: row, update: row })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ThemeTitleAlreadyUsedError(row.categoryId, row.normalizedTitle, { cause: error })
      }

      throw new DatabaseError('Failed to save the theme', {
        cause: error,
        context: { themeId: row.id },
      })
    }
  }

  async countPublishedBy(combination: ThemeCombination): Promise<number> {
    try {
      return await this.prisma.theme.count({
        where: { ...combination, publicationStatus: PUBLISHED_STATUS },
      })
    } catch (error) {
      throw new DatabaseError('Failed to count published themes', {
        cause: error,
        context: { categoryId: combination.categoryId, difficulty: combination.difficulty },
      })
    }
  }

  async drawPublished(combination: ThemeCombination): Promise<Theme | null> {
    try {
      const rows = await this.prisma.$queryRaw`
        SELECT
          "id",
          "category_id" AS "categoryId",
          "title",
          "normalized_title" AS "normalizedTitle",
          "difficulty",
          "publication_status" AS "publicationStatus",
          "created_at" AS "createdAt"
        FROM "themes"
        WHERE "category_id" = ${combination.categoryId}
          AND "difficulty" = ${combination.difficulty}::"theme_difficulty"
          AND "publication_status" = 'published'::"theme_publication_status"
        ORDER BY random()
        LIMIT 1
      `
      const row = rows[0]

      return row === undefined ? null : this.mapper.toDomain(row)
    } catch (error) {
      throw new DatabaseError('Failed to draw a published theme', {
        cause: error,
        context: { categoryId: combination.categoryId, difficulty: combination.difficulty },
      })
    }
  }

  async listPublishedCombinations(): Promise<ThemeCombination[]> {
    try {
      return await this.prisma.theme.findMany({
        where: { publicationStatus: PUBLISHED_STATUS },
        distinct: ['categoryId', 'difficulty'],
        select: { categoryId: true, difficulty: true },
      })
    } catch (error) {
      throw new DatabaseError('Failed to list published theme combinations', { cause: error })
    }
  }
}
