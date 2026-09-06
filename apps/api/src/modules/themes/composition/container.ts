import { CreateThemeCategoryUseCase } from '@/modules/themes/application/use-cases/create-theme-category/index.js'
import { CreateThemeUseCase } from '@/modules/themes/application/use-cases/create-theme/index.js'
import { DrawEligibleThemeUseCase } from '@/modules/themes/application/use-cases/draw-eligible-theme/index.js'
import { FindThemeByIdUseCase } from '@/modules/themes/application/use-cases/find-theme-by-id/index.js'
import { ListThemeCategoriesUseCase } from '@/modules/themes/application/use-cases/list-theme-categories/index.js'
import { ListThemeTitlesUseCase } from '@/modules/themes/application/use-cases/list-theme-titles/index.js'
import { MoveThemeToDraftUseCase } from '@/modules/themes/application/use-cases/move-theme-to-draft/index.js'
import { PublishThemeUseCase } from '@/modules/themes/application/use-cases/publish-theme/index.js'
import { SynchronizeThemeCatalogUseCase } from '@/modules/themes/application/use-cases/synchronize-theme-catalog/index.js'
import { WithdrawThemeUseCase } from '@/modules/themes/application/use-cases/withdraw-theme/index.js'
import type { Clock } from '@/modules/themes/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/themes/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { ThemePoolAudit } from '@/modules/themes/domain/ports/theme-pool-audit/index.js'
import type { UnitOfWork } from '@/modules/themes/domain/ports/unit-of-work/index.js'
import type {
  ThemeCatalogCategoriesRepository,
  ThemeCategoriesRepository,
} from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type {
  ThemeCatalogThemesRepository,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { PrismaUnitOfWorkAdapter } from '@/modules/themes/infrastructure/adapters/prisma-unit-of-work-adapter/index.js'
import { ThemePoolAuditAdapter } from '@/modules/themes/infrastructure/adapters/theme-pool-audit-adapter/index.js'
import type {
  ThemesPrismaClient,
  ThemesPrismaTransactionRunner,
} from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'
import { ThemesTransactionContext } from '@/modules/themes/infrastructure/clients/themes-transaction-context/index.js'
import { ThemeCategoryMapper } from '@/modules/themes/infrastructure/mappers/theme-category-mapper/index.js'
import { ThemeMapper } from '@/modules/themes/infrastructure/mappers/theme-mapper/index.js'
import { PrismaThemeCategoriesRepository } from '@/modules/themes/infrastructure/repositories/prisma-theme-categories-repository/index.js'
import { PrismaThemesRepository } from '@/modules/themes/infrastructure/repositories/prisma-themes-repository/index.js'

import { createThemesFacade } from './facade.js'

export interface ThemesAdapterOverrides {
  readonly themes?: ThemesRepository & ThemeCatalogThemesRepository
  readonly categories?: ThemeCategoriesRepository & ThemeCatalogCategoriesRepository
  readonly unitOfWork?: UnitOfWork
  readonly themePoolAudit?: ThemePoolAudit
}

export interface ThemesModuleDeps {
  readonly prisma: ThemesPrismaClient & ThemesPrismaTransactionRunner
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly eventPublisher: EventPublisher
  readonly adapters?: ThemesAdapterOverrides
}

export function createThemesContainer(deps: ThemesModuleDeps) {
  const adapters = deps.adapters ?? {}
  const transactionContext = new ThemesTransactionContext()
  const unitOfWork =
    adapters.unitOfWork ?? new PrismaUnitOfWorkAdapter(deps.prisma, transactionContext)

  const themes =
    adapters.themes ??
    new PrismaThemesRepository(deps.prisma, transactionContext, new ThemeMapper())
  const categories =
    adapters.categories ??
    new PrismaThemeCategoriesRepository(deps.prisma, transactionContext, new ThemeCategoryMapper())

  const themePoolAudit =
    adapters.themePoolAudit ??
    new ThemePoolAuditAdapter({
      themes,
      categories,
      clock: deps.clock,
      idGenerator: deps.idGenerator,
      eventPublisher: deps.eventPublisher,
    })

  const useCases = {
    createThemeCategory: new CreateThemeCategoryUseCase({
      categories,
      idGenerator: deps.idGenerator,
    }),
    createTheme: new CreateThemeUseCase({
      themes,
      categories,
      clock: deps.clock,
      idGenerator: deps.idGenerator,
      eventPublisher: deps.eventPublisher,
    }),
    drawEligibleTheme: new DrawEligibleThemeUseCase({
      themes,
      categories,
      clock: deps.clock,
      idGenerator: deps.idGenerator,
      eventPublisher: deps.eventPublisher,
    }),
    findThemeById: new FindThemeByIdUseCase({ themes, categories }),
    listThemeCategories: new ListThemeCategoriesUseCase({ categories }),
    listThemeTitles: new ListThemeTitlesUseCase({ themes }),
    moveThemeToDraft: new MoveThemeToDraftUseCase({ themes, themePoolAudit }),
    publishTheme: new PublishThemeUseCase({ themes, themePoolAudit }),
    synchronizeThemeCatalog: new SynchronizeThemeCatalogUseCase({
      themes,
      categories,
      clock: deps.clock,
      idGenerator: deps.idGenerator,
      eventPublisher: deps.eventPublisher,
      unitOfWork,
    }),
    withdrawTheme: new WithdrawThemeUseCase({ themes, themePoolAudit }),
  }

  const publicApi = createThemesFacade({
    drawEligibleTheme: useCases.drawEligibleTheme,
    findThemeById: useCases.findThemeById,
    listThemeCategories: useCases.listThemeCategories,
    listThemeTitles: useCases.listThemeTitles,
  })

  return { publicApi, repositories: { themes, categories }, useCases }
}

export type ThemesContainer = ReturnType<typeof createThemesContainer>
