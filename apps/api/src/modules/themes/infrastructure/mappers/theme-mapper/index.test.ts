import { describe, expect, it } from 'vitest'

import type { Theme as ThemeRow } from '@/generated/prisma/client.js'

import { ThemeMapper } from './index.js'

const row: ThemeRow = {
  id: '1d3e3f45-8bb3-48ca-a721-71276ed4f1f3',
  categoryId: '8526a22f-5ed3-4783-8b99-7536436bf0cf',
  title: 'Climate  Change',
  normalizedTitle: 'climate change',
  difficulty: 'hard',
  publicationStatus: 'withdrawn',
  createdAt: new Date('2026-08-16T00:00:00.000Z'),
}

describe('ThemeMapper', () => {
  it('round-trips the persisted row without losing catalog state or titles', () => {
    const mapper = new ThemeMapper()

    const theme = mapper.toDomain(row)

    expect(theme).toMatchObject({
      id: row.id,
      categoryId: row.categoryId,
      difficulty: 'hard',
      publicationStatus: 'withdrawn',
    })
    expect(theme.title.value).toBe('Climate  Change')
    expect(theme.title.normalized).toBe('climate change')
    expect(mapper.toPersistence(theme)).toEqual(row)
  })
})
