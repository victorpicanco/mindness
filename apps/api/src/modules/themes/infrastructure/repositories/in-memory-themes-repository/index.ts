import type { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import type {
  ThemeCombination,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'

export class InMemoryThemesRepository implements ThemesRepository {
  private readonly themes: Theme[] = []
  private failure: BaseError | null = null

  findById(themeId: string): Promise<Theme | null> {
    const failure = this.takeSimulatedFailure()
    if (failure !== null) return Promise.reject(failure)

    return Promise.resolve(this.themes.find((theme) => theme.id === themeId) ?? null)
  }

  findByNormalizedTitle(params: {
    categoryId: string
    normalizedTitle: string
  }): Promise<Theme | null> {
    const failure = this.takeSimulatedFailure()
    if (failure !== null) return Promise.reject(failure)

    return Promise.resolve(
      this.themes.find(
        (theme) =>
          theme.categoryId === params.categoryId &&
          theme.title.normalized === params.normalizedTitle,
      ) ?? null,
    )
  }

  save(theme: Theme): Promise<void> {
    const failure = this.takeSimulatedFailure()
    if (failure !== null) return Promise.reject(failure)

    const existingIndex = this.themes.findIndex((storedTheme) => storedTheme.id === theme.id)

    if (existingIndex === -1) {
      this.themes.push(theme)
      return Promise.resolve()
    }

    this.themes[existingIndex] = theme
    return Promise.resolve()
  }

  countPublishedBy(combination: ThemeCombination): Promise<number> {
    const failure = this.takeSimulatedFailure()
    if (failure !== null) return Promise.reject(failure)

    return Promise.resolve(
      this.themes.filter((theme) => this.isPublishedForCombination(theme, combination)).length,
    )
  }

  drawPublished(combination: ThemeCombination): Promise<Theme | null> {
    const failure = this.takeSimulatedFailure()
    if (failure !== null) return Promise.reject(failure)

    return Promise.resolve(
      this.themes.find((theme) => this.isPublishedForCombination(theme, combination)) ?? null,
    )
  }

  listPublishedCombinations(): Promise<ThemeCombination[]> {
    const failure = this.takeSimulatedFailure()
    if (failure !== null) return Promise.reject(failure)

    const combinations: ThemeCombination[] = []

    for (const theme of this.themes) {
      if (!theme.isEligible()) continue

      const isAlreadyListed = combinations.some(
        (combination) =>
          combination.categoryId === theme.categoryId &&
          combination.difficulty === theme.difficulty,
      )
      if (!isAlreadyListed) {
        combinations.push({ categoryId: theme.categoryId, difficulty: theme.difficulty })
      }
    }

    return Promise.resolve(combinations)
  }

  simulateFailure(error: BaseError): void {
    this.failure = error
  }

  private isPublishedForCombination(theme: Theme, combination: ThemeCombination): boolean {
    return (
      theme.isEligible() &&
      theme.categoryId === combination.categoryId &&
      theme.difficulty === combination.difficulty
    )
  }

  private takeSimulatedFailure(): BaseError | null {
    if (this.failure === null) return null

    const failure = this.failure
    this.failure = null
    return failure
  }
}
