import type {
  DrawEligibleThemeInput,
  DrawEligibleThemeOutput,
} from '@/modules/themes/application/use-cases/draw-eligible-theme/index.js'
import type {
  FindThemeByIdInput,
  FindThemeByIdOutput,
} from '@/modules/themes/application/use-cases/find-theme-by-id/index.js'
import type {
  ListThemeCategoriesInput,
  ListThemeCategoriesOutput,
} from '@/modules/themes/application/use-cases/list-theme-categories/index.js'

type ThemeDifficulty = 'easy' | 'balanced' | 'hard'

export interface PublicTheme {
  readonly themeId: string
  readonly title: string
  readonly categorySlug: string
  readonly difficulty: ThemeDifficulty
}

export interface PublicThemeCategory {
  readonly categoryId: string
  readonly slug: string
  readonly name: string
}

export interface ThemesPublicApi {
  drawEligibleTheme(input: DrawEligibleThemeInput): Promise<PublicTheme | null>
  findThemeById(themeId: string): Promise<PublicTheme>
  listCategories(): Promise<readonly PublicThemeCategory[]>
}

interface DrawEligibleTheme {
  execute(input: DrawEligibleThemeInput): Promise<DrawEligibleThemeOutput | null>
}

interface FindThemeById {
  execute(input: FindThemeByIdInput): Promise<FindThemeByIdOutput>
}

interface ListThemeCategories {
  execute(input: ListThemeCategoriesInput): Promise<ListThemeCategoriesOutput>
}

export interface ThemesPublicApiDependencies {
  readonly drawEligibleTheme: DrawEligibleTheme
  readonly findThemeById: FindThemeById
  readonly listThemeCategories: ListThemeCategories
}

export class ThemesPublicApiImpl implements ThemesPublicApi {
  constructor(private readonly dependencies: ThemesPublicApiDependencies) {}

  async drawEligibleTheme(input: DrawEligibleThemeInput): Promise<PublicTheme | null> {
    const theme = await this.dependencies.drawEligibleTheme.execute(input)

    return theme === null ? null : this.toPublicTheme(theme)
  }

  async findThemeById(themeId: string): Promise<PublicTheme> {
    return this.toPublicTheme(await this.dependencies.findThemeById.execute({ themeId }))
  }

  async listCategories(): Promise<readonly PublicThemeCategory[]> {
    const categories = await this.dependencies.listThemeCategories.execute(null)

    return categories.map((category) => ({
      categoryId: category.categoryId,
      slug: category.slug,
      name: category.name,
    }))
  }

  private toPublicTheme(theme: DrawEligibleThemeOutput | FindThemeByIdOutput): PublicTheme {
    return {
      themeId: theme.themeId,
      title: theme.title,
      categorySlug: theme.categorySlug,
      difficulty: theme.difficulty,
    }
  }
}
