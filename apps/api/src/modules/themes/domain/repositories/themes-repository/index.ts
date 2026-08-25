import type { Theme, ThemeDifficulty } from '@/modules/themes/domain/entities/theme/index.js'

export interface ThemeCombination {
  readonly categoryId: string
  readonly difficulty: ThemeDifficulty
}

export interface ThemesRepository {
  findById(themeId: string): Promise<Theme | null>
  listByIds(themeIds: readonly string[]): Promise<Theme[]>
  findByNormalizedTitle(params: {
    categoryId: string
    normalizedTitle: string
  }): Promise<Theme | null>
  save(theme: Theme): Promise<void>
  countPublishedBy(combination: ThemeCombination): Promise<number>
  drawPublished(combination: ThemeCombination): Promise<Theme | null>
  listPublishedCombinations(): Promise<ThemeCombination[]>
}
