import type { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'

export interface ThemeCategoriesRepository {
  findById(categoryId: string): Promise<ThemeCategory | null>
  findBySlug(slug: string): Promise<ThemeCategory | null>
  save(category: ThemeCategory): Promise<void>
  listWithPublishedThemes(): Promise<ThemeCategory[]>
}

export interface ThemeCatalogCategoriesRepository {
  listBySlugs(slugs: readonly string[]): Promise<ThemeCategory[]>
  saveMany(categories: readonly ThemeCategory[]): Promise<void>
}
