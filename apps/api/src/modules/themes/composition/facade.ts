import type { DrawEligibleThemeUseCase } from '@/modules/themes/application/use-cases/draw-eligible-theme/index.js'
import type { FindThemeByIdUseCase } from '@/modules/themes/application/use-cases/find-theme-by-id/index.js'
import type { ListThemeCategoriesUseCase } from '@/modules/themes/application/use-cases/list-theme-categories/index.js'
import {
  ThemesPublicApiImpl,
  type ThemesPublicApi,
} from '@/modules/themes/presentation/public-api/index.js'

export function createThemesFacade(dependencies: {
  readonly drawEligibleTheme: DrawEligibleThemeUseCase
  readonly findThemeById: FindThemeByIdUseCase
  readonly listThemeCategories: ListThemeCategoriesUseCase
}): ThemesPublicApi {
  return new ThemesPublicApiImpl(dependencies)
}
