import type {
  ThemeDifficulty,
  ThemePublicationStatus,
} from '@/modules/themes/domain/entities/theme/index.js'

export interface CreateThemeInput {
  readonly title: string
  readonly categorySlug: string
  readonly difficulty: ThemeDifficulty
}

export interface CreateThemeOutput {
  readonly themeId: string
  readonly title: string
  readonly categorySlug: string
  readonly difficulty: ThemeDifficulty
  readonly publicationStatus: ThemePublicationStatus
  readonly createdAt: Date
}
