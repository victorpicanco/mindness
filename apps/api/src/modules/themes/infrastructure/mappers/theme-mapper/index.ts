import type { Theme as ThemeRow } from '@/generated/prisma/client.js'
import { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

export class ThemeMapper {
  toDomain(row: ThemeRow): Theme {
    const title = ThemeTitle.create(row.title)
    if (title.normalized !== row.normalizedTitle) {
      throw new DatabaseError('Persisted theme title is inconsistent', {
        context: { themeId: row.id },
      })
    }

    return Theme.reconstitute({
      id: row.id,
      title,
      categoryId: row.categoryId,
      difficulty: row.difficulty,
      publicationStatus: row.publicationStatus,
      createdAt: row.createdAt,
    })
  }

  toPersistence(theme: Theme): ThemeRow {
    return {
      id: theme.id,
      categoryId: theme.categoryId,
      title: theme.title.value,
      normalizedTitle: theme.title.normalized,
      difficulty: theme.difficulty,
      publicationStatus: theme.publicationStatus,
      createdAt: theme.createdAt,
    }
  }
}
