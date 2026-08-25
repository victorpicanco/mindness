import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'

import type { ListThemeTitlesInput, ListThemeTitlesOutput } from './types.js'

export interface ListThemeTitlesDependencies {
  readonly themes: ThemesRepository
}

export class ListThemeTitlesUseCase {
  constructor(private readonly dependencies: ListThemeTitlesDependencies) {}

  async execute(input: ListThemeTitlesInput): Promise<ListThemeTitlesOutput> {
    const themeIds = [...new Set(input.themeIds)]
    const themes = await this.dependencies.themes.listByIds(themeIds)

    return themes.map((theme) => ({ themeId: theme.id, title: theme.title.value }))
  }
}

export type { ListThemeTitlesInput, ListThemeTitlesOutput, ThemeTitleProjection } from './types.js'
