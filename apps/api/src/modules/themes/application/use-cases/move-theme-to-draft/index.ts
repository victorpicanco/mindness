import { ThemeNotFoundError } from '@/modules/themes/domain/errors/theme-not-found-error/index.js'
import type { ThemePoolAudit } from '@/modules/themes/domain/ports/theme-pool-audit/index.js'
import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'

import type { MoveThemeToDraftInput, MoveThemeToDraftOutput } from './types.js'

export interface MoveThemeToDraftDependencies {
  readonly themes: ThemesRepository
  readonly themePoolAudit: ThemePoolAudit
}

export class MoveThemeToDraftUseCase {
  constructor(private readonly dependencies: MoveThemeToDraftDependencies) {}

  async execute(input: MoveThemeToDraftInput): Promise<MoveThemeToDraftOutput> {
    const theme = await this.dependencies.themes.findById(input.themeId)
    if (theme === null) throw new ThemeNotFoundError(input.themeId)

    theme.moveToDraft()
    await this.dependencies.themes.save(theme)
    await this.dependencies.themePoolAudit.record({
      categoryId: theme.categoryId,
      difficulty: theme.difficulty,
    })

    return { themeId: theme.id, publicationStatus: theme.publicationStatus }
  }
}

export type { MoveThemeToDraftInput, MoveThemeToDraftOutput } from './types.js'
