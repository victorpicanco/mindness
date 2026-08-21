import type { ThemesPublicApi } from '@/modules/themes/index.js'
import type { ThemesPort } from '@/modules/analyses/domain/ports/themes-port/index.js'
import { NotFoundError } from '@/shared/errors/categories/not-found-error/index.js'

export type ThemesTitleReader = Pick<ThemesPublicApi, 'findThemeById'>
export class ThemesPortAdapter implements ThemesPort {
  constructor(private readonly themes: ThemesTitleReader) {}

  async findTitle(themeId: string): Promise<string | null> {
    try {
      return (await this.themes.findThemeById(themeId)).title
    } catch (error) {
      if (error instanceof NotFoundError) return null
      throw error
    }
  }
}
