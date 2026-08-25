import type { SessionDifficulty } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

export interface DrawEligibleThemeInput {
  readonly categorySlug: string
  readonly difficulty: SessionDifficulty
}

export interface EligibleTheme {
  readonly themeId: string
  readonly title: string
}

export interface EligibleThemeCategory {
  readonly categoryId: string
  readonly slug: string
  readonly name: string
}

export interface ThemeTitle {
  readonly themeId: string
  readonly title: string
}

export interface ThemesPort {
  drawEligibleTheme(input: DrawEligibleThemeInput): Promise<EligibleTheme | null>
  findThemeById(themeId: string): Promise<{ readonly themeId: string; readonly title: string }>
  listCategories(): Promise<EligibleThemeCategory[]>
  listThemeTitles(themeIds: readonly string[]): Promise<readonly ThemeTitle[]>
}
