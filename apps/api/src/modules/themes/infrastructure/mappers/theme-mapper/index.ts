import type { Theme as ThemeRow } from '@/generated/prisma/client.js'
import { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'

export class ThemeMapper {
  toDomain(row: ThemeRow): Theme {
    const theme = Theme.create({
      id: row.id,
      title: ThemeTitle.create(row.title),
      categoryId: row.categoryId,
      difficulty: row.difficulty,
      createdAt: row.createdAt,
    })

    if (row.publicationStatus === 'published') theme.publish()
    if (row.publicationStatus === 'withdrawn') theme.withdraw()

    return theme
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
