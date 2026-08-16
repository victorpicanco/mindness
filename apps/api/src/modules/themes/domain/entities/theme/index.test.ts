import { describe, expect, it } from 'vitest'

import { InvalidThemeTransitionError } from '@/modules/themes/domain/errors/invalid-theme-transition-error/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'

import { Theme } from './index.js'

function createTheme(): Theme {
  return Theme.create({
    id: 'theme-1',
    title: ThemeTitle.create('Mindful breathing'),
    categoryId: 'category-1',
    difficulty: 'easy',
    createdAt: new Date('2026-08-16T12:00:00.000Z'),
  })
}

describe('Theme', () => {
  it('starts as a draft', () => {
    const theme = createTheme()

    expect(theme.publicationStatus).toBe('draft')
    expect(theme.isEligible()).toBe(false)
  })

  it('moves through publication states', () => {
    const theme = createTheme()

    theme.publish()
    expect(theme.publicationStatus).toBe('published')
    expect(theme.isEligible()).toBe(true)

    theme.withdraw()
    expect(theme.publicationStatus).toBe('withdrawn')
    expect(theme.isEligible()).toBe(false)

    theme.publish()
    expect(theme.publicationStatus).toBe('published')

    theme.moveToDraft()
    expect(theme.publicationStatus).toBe('draft')
  })

  it('rejects a transition to the current state', () => {
    const theme = createTheme()

    expect(() => theme.moveToDraft()).toThrow(InvalidThemeTransitionError)
  })

  it('does not expose its created date by alias', () => {
    const theme = createTheme()
    const firstRead = theme.createdAt

    firstRead.setUTCFullYear(2000)

    expect(theme.createdAt).toEqual(new Date('2026-08-16T12:00:00.000Z'))
    expect(theme.createdAt).not.toBe(firstRead)
  })
})
