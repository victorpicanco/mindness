import { describe, expect, it } from 'vitest'

import { BaseError } from '@/shared/errors/base-error/index.js'

import { InvalidThemeTransitionError } from '@/modules/themes/domain/errors/invalid-theme-transition-error/index.js'
import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'
import { ThemeCategoryNotFoundError } from '@/modules/themes/domain/errors/theme-category-not-found-error/index.js'
import { ThemeNotFoundError } from '@/modules/themes/domain/errors/theme-not-found-error/index.js'

import { ThemeTitleAlreadyUsedError } from './index.js'

describe('theme domain errors', () => {
  it.each([
    [new InvalidThemeValueError('title'), 'themes.INVALID_THEME_VALUE', 422, { field: 'title' }],
    [
      new ThemeTitleAlreadyUsedError('category-1', 'mindful breathing'),
      'themes.THEME_TITLE_ALREADY_USED',
      409,
      { categoryId: 'category-1', normalizedTitle: 'mindful breathing' },
    ],
    [new ThemeNotFoundError('theme-1'), 'themes.THEME_NOT_FOUND', 404, { themeId: 'theme-1' }],
    [
      new ThemeCategoryNotFoundError('category-1'),
      'themes.THEME_CATEGORY_NOT_FOUND',
      404,
      { categoryId: 'category-1' },
    ],
    [
      new InvalidThemeTransitionError('draft', 'draft'),
      'themes.INVALID_THEME_TRANSITION',
      409,
      { currentStatus: 'draft', targetStatus: 'draft' },
    ],
  ])('has the expected code, HTTP status, and context', (error, code, httpStatus, context) => {
    expect(error).toBeInstanceOf(BaseError)
    expect(error.code).toBe(code)
    expect(error.httpStatus).toBe(httpStatus)
    expect(error.context).toEqual(context)
  })
})
