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

export interface SynchronizeThemeCatalogOptions {
  readonly mode: 'preview' | 'apply'
}

export interface ThemeCatalogChangeCounts {
  readonly created: number
  readonly updated: number
  readonly unchanged: number
}

export interface ThemeCatalogChanges {
  readonly categories: ThemeCatalogChangeCounts
  readonly themes: ThemeCatalogChangeCounts
}

export interface ThemePoolReport {
  readonly categorySlug: string
  readonly difficulty: ThemeDifficulty
  readonly publishedCount: number
  readonly minimum: number
}

export interface ThemeCatalogDivergence {
  readonly categorySlug: string
  readonly title: string
  readonly reason: 'manual_withdrawal_preserved'
}

export interface SynchronizeThemeCatalogOutput {
  readonly poolReports: readonly ThemePoolReport[]
  readonly divergences: readonly ThemeCatalogDivergence[]
  readonly changes: ThemeCatalogChanges
}
