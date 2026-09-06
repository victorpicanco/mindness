import { Prisma } from '@/generated/prisma/client.js'
import type { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeTitleAlreadyUsedError } from '@/modules/themes/domain/errors/theme-title-already-used-error/index.js'
import type {
  ThemeCombination,
  ThemePoolCount,
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

function isThemePoolCount(value: unknown): value is ThemePoolCount {
  if (typeof value !== 'object' || value === null) return false
  if (!('categoryId' in value) || !('difficulty' in value) || !('publishedCount' in value)) {
    return false
  }

  return (
    typeof value.categoryId === 'string' &&
    (value.difficulty === 'easy' ||
      value.difficulty === 'balanced' ||
      value.difficulty === 'hard') &&
    typeof value.publishedCount === 'number' &&
    Number.isInteger(value.publishedCount) &&
    value.publishedCount >= 0
  )
}

function themePoolCounts(raw: unknown): ThemePoolCount[] {
  if (!Array.isArray(raw) || !raw.every(isThemePoolCount)) {
    throw new DatabaseError('Received invalid theme pool counts from the database')
  }

  return raw
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

  async listByIds(themeIds: readonly string[]): Promise<Theme[]> {
    if (themeIds.length === 0) return []

    let rows
    try {
      rows = await this.client().theme.findMany({ where: { id: { in: [...themeIds] } } })
    } catch (error) {
      throw new DatabaseError('Failed to read the themes', {
        cause: error,
        context: { themeIds: [...themeIds] },
      })
    }

    return rows.map((row) => this.mapper.toDomain(row))
  }

  async listByCategoryIds(categoryIds: readonly string[]): Promise<Theme[]> {
    if (categoryIds.length === 0) return []

    let rows
    try {
      rows = await this.client().theme.findMany({
        where: { categoryId: { in: [...categoryIds] } },
      })
    } catch (error) {
      throw new DatabaseError('Failed to read themes by category', {
        cause: error,
        context: { categoryIds: [...categoryIds] },
      })
    }

    return rows.map((row) => this.mapper.toDomain(row))
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

  async saveMany(themes: readonly Theme[]): Promise<void> {
    if (themes.length === 0) return
    const rows = themes.map((theme) => this.mapper.toPersistence(theme))
    const values = rows.map(
      (row) => Prisma.sql`(
        ${row.id}::uuid,
        ${row.categoryId}::uuid,
        ${row.title},
        ${row.normalizedTitle},
        ${row.difficulty}::"theme_difficulty",
        ${row.publicationStatus}::"theme_publication_status",
        ${row.createdAt}
      )`,
    )

    try {
      await this.client().$executeRaw(
        Prisma.sql`
          INSERT INTO "themes" (
            "id",
            "category_id",
            "title",
            "normalized_title",
            "difficulty",
            "publication_status",
            "created_at"
          )
          VALUES ${Prisma.join(values)}
          ON CONFLICT ("category_id", "normalized_title")
          DO UPDATE SET
            "title" = EXCLUDED."title",
            "difficulty" = EXCLUDED."difficulty",
            "publication_status" = EXCLUDED."publication_status"
        `,
      )
    } catch (error) {
      throw new DatabaseError('Failed to save the theme catalog batch', {
        cause: error,
        context: { themeCount: themes.length },
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

  async countPublishedByMany(
    combinations: readonly ThemeCombination[],
  ): Promise<readonly ThemePoolCount[]> {
    if (combinations.length === 0) return []
    const categoryIds = [...new Set(combinations.map((combination) => combination.categoryId))]

    let raw: unknown
    try {
      raw = await this.client().$queryRaw(
        Prisma.sql`
          SELECT
            "category_id" AS "categoryId",
            "difficulty",
            COUNT(*)::int AS "publishedCount"
          FROM "themes"
          WHERE "publication_status" = 'published'::"theme_publication_status"
            AND "category_id" IN (${Prisma.join(categoryIds)})
          GROUP BY "category_id", "difficulty"
        `,
      )
    } catch (error) {
      throw new DatabaseError('Failed to count published theme pools', {
        cause: error,
        context: { categoryIds },
      })
    }

    return themePoolCounts(raw)
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
