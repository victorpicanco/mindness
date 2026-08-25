export interface ListThemeTitlesInput {
  readonly themeIds: readonly string[]
}

export interface ThemeTitleProjection {
  readonly themeId: string
  readonly title: string
}

export type ListThemeTitlesOutput = readonly ThemeTitleProjection[]
