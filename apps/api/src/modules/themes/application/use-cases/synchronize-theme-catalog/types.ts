import type {
  ThemeDifficulty,
  ThemePublicationStatus,
} from '@/modules/themes/domain/entities/theme/index.js'

export interface ThemeCatalogEntry {
  readonly title: string
  readonly difficulty: ThemeDifficulty
  readonly publicationStatus: ThemePublicationStatus
}

export interface ThemeCatalogCategory {
  readonly slug: string
  readonly name: string
  readonly themes: readonly ThemeCatalogEntry[]
}

export interface SynchronizeThemeCatalogInput {
  readonly categories: readonly ThemeCatalogCategory[]
}

export interface ThemePoolReport {
  readonly categorySlug: string
  readonly difficulty: ThemeDifficulty
  readonly publishedCount: number
  readonly minimum: number
}

export interface SynchronizeThemeCatalogOutput {
  readonly poolReports: readonly ThemePoolReport[]
}
