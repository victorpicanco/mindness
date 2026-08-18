import { describe, expect, it } from 'vitest'

import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'

import { ThemeCategoryMapper } from './index.js'

describe('ThemeCategoryMapper', () => {
  it('maps a category in both directions without losing its fields', () => {
    const mapper = new ThemeCategoryMapper()
    const category = ThemeCategory.create({
      id: 'category-1',
      slug: CategorySlug.create('mindfulness'),
      name: 'Mindfulness',
    })

    const row = mapper.toPersistence(category)

    expect(row).toEqual({ id: 'category-1', slug: 'mindfulness', name: 'Mindfulness' })
    expect(mapper.toDomain(row)).toMatchObject({
      id: 'category-1',
      slug: { value: 'mindfulness' },
      name: 'Mindfulness',
    })
  })
})
