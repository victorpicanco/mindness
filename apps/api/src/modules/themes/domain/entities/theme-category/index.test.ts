import { describe, expect, it } from 'vitest'

import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'

import { ThemeCategory } from './index.js'

describe('ThemeCategory', () => {
  it('rejects invalid names when creating and renaming', () => {
    expect(() =>
      ThemeCategory.create({
        id: 'category-1',
        slug: CategorySlug.create('mindfulness'),
        name: ' ',
      }),
    ).toThrow(InvalidThemeValueError)

    const category = ThemeCategory.create({
      id: 'category-1',
      slug: CategorySlug.create('mindfulness'),
      name: 'Mindfulness',
    })

    expect(() => category.rename(' ')).toThrow(InvalidThemeValueError)
    expect(category.name).toBe('Mindfulness')
  })
})
