import { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeRejected } from '@/modules/themes/domain/events/theme-rejected/index.js'
import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'
import { ThemeCategoryNotFoundError } from '@/modules/themes/domain/errors/theme-category-not-found-error/index.js'
import { ThemeTitleAlreadyUsedError } from '@/modules/themes/domain/errors/theme-title-already-used-error/index.js'
import type { Clock } from '@/modules/themes/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/themes/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'

import type { CreateThemeInput, CreateThemeOutput } from './types.js'

export interface CreateThemeDependencies {
  readonly themes: ThemesRepository
  readonly categories: ThemeCategoriesRepository
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
}

export class CreateThemeUseCase {
  constructor(private readonly dependencies: CreateThemeDependencies) {}

  async execute(input: CreateThemeInput): Promise<CreateThemeOutput> {
    try {
      const categorySlug = CategorySlug.create(input.categorySlug)
      const title = ThemeTitle.create(input.title)
      const category = await this.dependencies.categories.findBySlug(categorySlug.value)

      if (category === null) throw new ThemeCategoryNotFoundError(categorySlug.value)

      const existingTheme = await this.dependencies.themes.findByNormalizedTitle({
        categoryId: category.id,
        normalizedTitle: title.normalized,
      })

      if (existingTheme !== null) {
        throw new ThemeTitleAlreadyUsedError(category.id, title.normalized)
      }

      const theme = Theme.create({
        id: this.dependencies.idGenerator.generate(),
        title,
        categoryId: category.id,
        difficulty: input.difficulty,
        createdAt: this.dependencies.clock.now(),
      })
      await this.dependencies.themes.save(theme)

      return {
        themeId: theme.id,
        title: theme.title.value,
        categorySlug: category.slug.value,
        difficulty: theme.difficulty,
        publicationStatus: theme.publicationStatus,
        createdAt: theme.createdAt,
      }
    } catch (error) {
      if (!this.isRejection(error)) throw error

      await this.dependencies.eventPublisher.publish(
        ThemeRejected.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: this.dependencies.clock.now(),
          title: input.title,
          categorySlug: input.categorySlug,
          difficulty: input.difficulty,
          issues: [this.toIssue(error)],
        }),
      )
      throw error
    }
  }

  private isRejection(
    error: unknown,
  ): error is InvalidThemeValueError | ThemeCategoryNotFoundError | ThemeTitleAlreadyUsedError {
    return (
      error instanceof InvalidThemeValueError ||
      error instanceof ThemeCategoryNotFoundError ||
      error instanceof ThemeTitleAlreadyUsedError
    )
  }

  private toIssue(
    error: InvalidThemeValueError | ThemeCategoryNotFoundError | ThemeTitleAlreadyUsedError,
  ): {
    readonly field: string
    readonly reason: string
  } {
    if (error instanceof InvalidThemeValueError) {
      const field = error.context.field
      return { field: typeof field === 'string' ? field : 'theme', reason: 'is invalid' }
    }
    if (error instanceof ThemeCategoryNotFoundError) {
      return { field: 'category', reason: 'not found' }
    }
    return { field: 'title', reason: 'already used' }
  }
}

export type { CreateThemeInput, CreateThemeOutput } from './types.js'
