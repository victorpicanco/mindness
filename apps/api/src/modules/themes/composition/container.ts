import { CheckThemePoolUseCase } from '@/modules/themes/application/use-cases/check-theme-pool/index.js'
import { CreateThemeCategoryUseCase } from '@/modules/themes/application/use-cases/create-theme-category/index.js'
import { CreateThemeUseCase } from '@/modules/themes/application/use-cases/create-theme/index.js'
import { DrawEligibleThemeUseCase } from '@/modules/themes/application/use-cases/draw-eligible-theme/index.js'
import { FindThemeByIdUseCase } from '@/modules/themes/application/use-cases/find-theme-by-id/index.js'
import { ListThemeCategoriesUseCase } from '@/modules/themes/application/use-cases/list-theme-categories/index.js'
import { MoveThemeToDraftUseCase } from '@/modules/themes/application/use-cases/move-theme-to-draft/index.js'
import { PublishThemeUseCase } from '@/modules/themes/application/use-cases/publish-theme/index.js'
import { SynchronizeThemeCatalogUseCase } from '@/modules/themes/application/use-cases/synchronize-theme-catalog/index.js'
import { WithdrawThemeUseCase } from '@/modules/themes/application/use-cases/withdraw-theme/index.js'
import type { Clock } from '@/modules/themes/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/themes/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'
import type { ThemesPrismaClient } from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'
import { ThemeCategoryMapper } from '@/modules/themes/infrastructure/mappers/theme-category-mapper/index.js'
import { ThemeMapper } from '@/modules/themes/infrastructure/mappers/theme-mapper/index.js'
import { PrismaThemeCategoriesRepository } from '@/modules/themes/infrastructure/repositories/prisma-theme-categories-repository/index.js'
import { PrismaThemesRepository } from '@/modules/themes/infrastructure/repositories/prisma-themes-repository/index.js'

import { createThemesFacade } from './facade.js'

export interface ThemesAdapterOverrides {
  readonly themes?: ThemesRepository
  readonly categories?: ThemeCategoriesRepository
}

export interface ThemesModuleDeps {
  readonly prisma: ThemesPrismaClient
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly eventPublisher: EventPublisher
  readonly adapters?: ThemesAdapterOverrides
}

export function createThemesContainer(deps: ThemesModuleDeps) {
  const adapters = deps.adapters ?? {}

  const themes = adapters.themes ?? new PrismaThemesRepository(deps.prisma, new ThemeMapper())
  const categories =
    adapters.categories ??
    new PrismaThemeCategoriesRepository(deps.prisma, new ThemeCategoryMapper())

  const shared = {
    themes,
    categories,
    clock: deps.clock,
    idGenerator: deps.idGenerator,
    eventPublisher: deps.eventPublisher,
  }

  const useCases = {
    checkThemePool: new CheckThemePoolUseCase(shared),
    createThemeCategory: new CreateThemeCategoryUseCase({
      categories,
      idGenerator: deps.idGenerator,
    }),
    createTheme: new CreateThemeUseCase(shared),
    drawEligibleTheme: new DrawEligibleThemeUseCase(shared),
    findThemeById: new FindThemeByIdUseCase({ themes, categories }),
    listThemeCategories: new ListThemeCategoriesUseCase({ categories }),
    moveThemeToDraft: new MoveThemeToDraftUseCase(shared),
    publishTheme: new PublishThemeUseCase(shared),
    synchronizeThemeCatalog: new SynchronizeThemeCatalogUseCase(shared),
    withdrawTheme: new WithdrawThemeUseCase(shared),
  }

  const publicApi = createThemesFacade({
    drawEligibleTheme: useCases.drawEligibleTheme,
    findThemeById: useCases.findThemeById,
    listThemeCategories: useCases.listThemeCategories,
  })

  return { publicApi, repositories: { themes, categories }, useCases }
}

export type ThemesContainer = ReturnType<typeof createThemesContainer>
