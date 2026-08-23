import type {
  EligibleThemeCategory,
  ThemesPort,
} from '@/modules/sessions/domain/ports/themes-port/index.js'

export interface ListSessionThemeCategoriesDependencies {
  readonly themes: ThemesPort
}

export class ListSessionThemeCategoriesUseCase {
  constructor(private readonly dependencies: ListSessionThemeCategoriesDependencies) {}

  async execute(): Promise<EligibleThemeCategory[]> {
    return this.dependencies.themes.listCategories()
  }
}
