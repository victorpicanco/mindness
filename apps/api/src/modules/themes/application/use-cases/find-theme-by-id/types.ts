import type { ThemeDifficulty } from '@/modules/themes/domain/entities/theme/index.js'

export interface FindThemeByIdOutput {
  readonly themeId: string
  readonly title: string
  readonly categorySlug: string
  readonly difficulty: ThemeDifficulty
}
