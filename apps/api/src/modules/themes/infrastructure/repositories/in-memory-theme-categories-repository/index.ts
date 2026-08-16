import type { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'

export class InMemoryThemeCategoriesRepository implements ThemeCategoriesRepository {
  private readonly categories: ThemeCategory[] = []
  private failure: BaseError | null = null

  constructor(private readonly themesRepository: ThemesRepository) {}

  findById(categoryId: string): Promise<ThemeCategory | null> {
    const failure = this.takeSimulatedFailure()
    if (failure !== null) return Promise.reject(failure)

    return Promise.resolve(this.categories.find((category) => category.id === categoryId) ?? null)
  }

  findBySlug(slug: string): Promise<ThemeCategory | null> {
    const failure = this.takeSimulatedFailure()
    if (failure !== null) return Promise.reject(failure)

    return Promise.resolve(this.categories.find((category) => category.slug.value === slug) ?? null)
  }

  save(category: ThemeCategory): Promise<void> {
    const failure = this.takeSimulatedFailure()
    if (failure !== null) return Promise.reject(failure)

    const existingIndex = this.categories.findIndex(
      (storedCategory) => storedCategory.id === category.id,
    )

    if (existingIndex === -1) {
      this.categories.push(category)
      return Promise.resolve()
    }

    this.categories[existingIndex] = category
    return Promise.resolve()
  }

  async listWithPublishedThemes(): Promise<ThemeCategory[]> {
    const failure = this.takeSimulatedFailure()
    if (failure !== null) return Promise.reject(failure)

    const combinations = await this.themesRepository.listPublishedCombinations()
    const publishedCategoryIds = new Set(combinations.map((combination) => combination.categoryId))

    return this.categories.filter((category) => publishedCategoryIds.has(category.id))
  }

  simulateFailure(error: BaseError): void {
    this.failure = error
  }

  private takeSimulatedFailure(): BaseError | null {
    if (this.failure === null) return null

    const failure = this.failure
    this.failure = null
    return failure
  }
}
