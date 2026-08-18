import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import type { ThemeCategoryRow } from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'

export class ThemeCategoryMapper {
  toDomain(row: ThemeCategoryRow): ThemeCategory {
    return ThemeCategory.create({
      id: row.id,
      slug: CategorySlug.create(row.slug),
      name: row.name,
    })
  }

  toPersistence(category: ThemeCategory): ThemeCategoryRow {
    return {
      id: category.id,
      slug: category.slug.value,
      name: category.name,
    }
  }
}
