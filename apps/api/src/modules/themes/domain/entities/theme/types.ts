import type { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'

export type ThemeDifficulty = 'easy' | 'balanced' | 'hard'
export type ThemePublicationStatus = 'draft' | 'published' | 'withdrawn'

export interface CreateThemeParams {
  readonly id: string
  readonly title: ThemeTitle
  readonly categoryId: string
  readonly difficulty: ThemeDifficulty
  readonly createdAt: Date
}
