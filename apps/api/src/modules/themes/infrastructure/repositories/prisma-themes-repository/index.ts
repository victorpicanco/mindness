import { Prisma } from '@/generated/prisma/client.js'
import type { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeTitleAlreadyUsedError } from '@/modules/themes/domain/errors/theme-title-already-used-error/index.js'
import type {
  ThemeCombination,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import type {
  ThemeRow,
  ThemesPrismaClient,
} from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'
import type { ThemesTransactionContext } from '@/modules/themes/infrastructure/clients/themes-transaction-context/index.js'
import type { ThemeMapper } from '@/modules/themes/infrastructure/mappers/theme-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

const UNIQUE_VIOLATION_CODE = 'P2002'
const PUBLISHED_STATUS = 'published'
const TITLE_UNIQUE_COLUMNS = new Set(['category_id', 'normalized_title'])

function isThemeRow(value: unknown): value is ThemeRow {
  if (typeof value !== 'object' || value === null) return false
  if (
    !('id' in value) ||
    !('categoryId' in value) ||
    !('title' in value) ||
    !('normalizedTitle' in value) ||
    !('difficulty' in value) ||
    !('publicationStatus' in value) ||
    !('createdAt' in value)
  ) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.categoryId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.normalizedTitle === 'string' &&
    (value.difficulty === 'easy' ||
      value.difficulty === 'balanced' ||
      value.difficulty === 'hard') &&
    (value.publicationStatus === 'draft' ||
      value.publicationStatus === 'published' ||
      value.publicationStatus === 'withdrawn') &&
    value.createdAt instanceof Date
  )
}

function rawThemeRow(raw: unknown, combination: ThemeCombination): ThemeRow | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (!isThemeRow(raw[0])) {
    throw new DatabaseError('Received an invalid published theme row from the database', {
      context: { categoryId: combination.categoryId, difficulty: combination.difficulty },
    })
  }

  return raw[0]
}

function isTitleUniqueViolation(error: Prisma.PrismaClientKnownRequestError): boolean {
  const target = error.meta?.target
  if (!Array.isArray(target) || target.length !== TITLE_UNIQUE_COLUMNS.size) return false

  return target.every((column) => typeof column === 'string' && TITLE_UNIQUE_COLUMNS.has(column))
}

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION_CODE
  )
}

export class PrismaThemesRepository implements ThemesRepository {
  constructor(
    private readonly prisma: ThemesPrismaClient,
    private readonly transactionContext: ThemesTransactionContext,
    private readonly mapper: ThemeMapper,
  ) {}

  async findById(themeId: string): Promise<Theme | null> {
    let row
    try {
      row = await this.client().theme.findUnique({ where: { id: themeId } })
    } catch (error) {
      throw new DatabaseError('Failed to read the theme', { cause: error, context: { themeId } })
    }

    return row === null ? null : this.mapper.toDomain(row)
  }

  async findByNormalizedTitle(params: {
    categoryId: string
    normalizedTitle: string
  }): Promise<Theme | null> {
    let row
    try {
      row = await this.client().theme.findFirst({ where: params })
    } catch (error) {
      throw new DatabaseError('Failed to read the theme', { cause: error, context: params })
    }

    return row === null ? null : this.mapper.toDomain(row)
  }

  async save(theme: Theme): Promise<void> {
    const row = this.mapper.toPersistence(theme)

    try {
      await this.client().theme.upsert({ where: { id: row.id }, create: row, update: row })
    } catch (error) {
      if (isUniqueViolation(error) && isTitleUniqueViolation(error)) {
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
      return await this.client().theme.count({
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
    let raw: unknown
    try {
      raw = await this.client().$queryRaw`
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
    } catch (error) {
      throw new DatabaseError('Failed to draw a published theme', {
        cause: error,
        context: { categoryId: combination.categoryId, difficulty: combination.difficulty },
      })
    }

    const row = rawThemeRow(raw, combination)

    return row === null ? null : this.mapper.toDomain(row)
  }

  async listPublishedCombinations(): Promise<ThemeCombination[]> {
    try {
      const rows = await this.client().theme.findMany({
        where: { publicationStatus: PUBLISHED_STATUS },
        distinct: ['categoryId', 'difficulty'],
        select: { categoryId: true, difficulty: true },
      })
      return rows.map((row) => ({ categoryId: row.categoryId, difficulty: row.difficulty }))
    } catch (error) {
      throw new DatabaseError('Failed to list published theme combinations', { cause: error })
    }
  }

  private client(): ThemesPrismaClient {
    return this.transactionContext.current() ?? this.prisma
  }
}
