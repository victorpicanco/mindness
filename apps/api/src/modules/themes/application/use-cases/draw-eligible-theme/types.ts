import type { ThemeDifficulty } from '@/modules/themes/domain/entities/theme/index.js'

export interface DrawEligibleThemeInput {
  readonly categorySlug: string
  readonly difficulty: ThemeDifficulty
}

export interface DrawEligibleThemeOutput {
  readonly themeId: string
  readonly title: string
  readonly categorySlug: string
  readonly difficulty: ThemeDifficulty
}
