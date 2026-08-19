import { describe, expect, it } from 'vitest'

import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

import { SessionConfiguration } from './index.js'

describe('SessionConfiguration', () => {
  it.each(['easy', 'balanced', 'hard'] as const)(
    'creates a configuration with %s difficulty',
    (difficulty) => {
      const configuration = SessionConfiguration.create({
        difficulty,
        categorySlug: 'self-awareness',
        searchWindowMinutes: 4,
      })

      expect(configuration.difficulty).toBe(difficulty)
      expect(configuration.categorySlug).toBe('self-awareness')
      expect(configuration.searchWindowMinutes).toBe(4)
    },
  )

  it.each([
    [
      { difficulty: 'invalid', categorySlug: 'self-awareness', searchWindowMinutes: 4 },
      'difficulty',
    ],
    [
      { difficulty: 'easy', categorySlug: 'self-awareness', searchWindowMinutes: 2 },
      'searchWindowMinutes',
    ],
    [{ difficulty: 'easy', categorySlug: '   ', searchWindowMinutes: 4 }, 'categorySlug'],
  ])('rejects an invalid %s configuration', (input, field) => {
    expect(() => SessionConfiguration.create(input)).toThrow(ValidationFailedError)
    expect(() => SessionConfiguration.create(input)).toThrow(
      expect.objectContaining({
        code: 'shared.VALIDATION_FAILED',
        context: { issues: [expect.objectContaining({ field })] },
      }),
    )
  })
})
