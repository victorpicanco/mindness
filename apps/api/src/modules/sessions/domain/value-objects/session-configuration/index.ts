import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

export type SessionDifficulty = 'easy' | 'balanced' | 'hard'
export type SearchWindowMinutes = 3 | 4 | 5

export interface CreateSessionConfigurationParams {
  readonly difficulty: string
  readonly categorySlug: string
  readonly searchWindowMinutes: number
}

function isSessionDifficulty(value: string): value is SessionDifficulty {
  return value === 'easy' || value === 'balanced' || value === 'hard'
}

function isSearchWindowMinutes(value: number): value is SearchWindowMinutes {
  return value === 3 || value === 4 || value === 5
}

export class SessionConfiguration {
  private constructor(
    readonly difficulty: SessionDifficulty,
    readonly categorySlug: string,
    readonly searchWindowMinutes: SearchWindowMinutes,
  ) {}

  static create(params: CreateSessionConfigurationParams): SessionConfiguration {
    if (!isSessionDifficulty(params.difficulty)) {
      throw new ValidationFailedError([{ field: 'difficulty', message: 'Difficulty is invalid' }])
    }
    if (params.categorySlug.trim().length === 0) {
      throw new ValidationFailedError([
        { field: 'categorySlug', message: 'Category slug is required' },
      ])
    }
    if (!isSearchWindowMinutes(params.searchWindowMinutes)) {
      throw new ValidationFailedError([
        { field: 'searchWindowMinutes', message: 'Search window minutes is invalid' },
      ])
    }

    return new SessionConfiguration(
      params.difficulty,
      params.categorySlug,
      params.searchWindowMinutes,
    )
  }
}
