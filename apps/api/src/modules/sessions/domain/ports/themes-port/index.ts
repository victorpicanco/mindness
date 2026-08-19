import type { SessionDifficulty } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

export interface DrawEligibleThemeInput {
  readonly categorySlug: string
  readonly difficulty: SessionDifficulty
}

export interface EligibleTheme {
  readonly themeId: string
}

export interface ThemesPort {
  drawEligibleTheme(input: DrawEligibleThemeInput): Promise<EligibleTheme | null>
}
