import { describe, expect, it } from 'vitest'
import { ThemeNotFoundError } from '@/modules/themes/domain/errors/theme-not-found-error/index.js'
import { ThemesPortAdapter } from './index.js'
describe('ThemesPortAdapter', () => {
  it('returns null when themes reports a missing theme', async () => {
    const adapter = new ThemesPortAdapter({
      findThemeById: () => Promise.reject(new ThemeNotFoundError('theme-id')),
    })
    await expect(adapter.findTitle('theme-id')).resolves.toBeNull()
  })
})
