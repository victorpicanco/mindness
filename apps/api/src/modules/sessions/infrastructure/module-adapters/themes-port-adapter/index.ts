import type { ThemesPublicApi } from '@/modules/themes/index.js'
import type {
  DrawEligibleThemeInput,
  EligibleTheme,
  EligibleThemeCategory,
  ThemesPort,
  ThemeTitle,
} from '@/modules/sessions/domain/ports/themes-port/index.js'

export type ThemesEligibilityReader = Pick<
  ThemesPublicApi,
  'drawEligibleTheme' | 'findThemeById' | 'listCategories' | 'listThemeTitles'
>

export class ThemesPortAdapter implements ThemesPort {
  constructor(private readonly themesFacade: ThemesEligibilityReader) {}

  async drawEligibleTheme(input: DrawEligibleThemeInput): Promise<EligibleTheme | null> {
    const theme = await this.themesFacade.drawEligibleTheme(input)
    return theme === null ? null : { themeId: theme.themeId, title: theme.title }
  }

  async findThemeById(
    themeId: string,
  ): Promise<{ readonly themeId: string; readonly title: string }> {
    const theme = await this.themesFacade.findThemeById(themeId)
    return { themeId: theme.themeId, title: theme.title }
  }

  async listThemeTitles(themeIds: readonly string[]): Promise<readonly ThemeTitle[]> {
    const titles = await this.themesFacade.listThemeTitles(themeIds)

    return titles.map((theme) => ({ themeId: theme.themeId, title: theme.title }))
  }

  async listCategories(): Promise<EligibleThemeCategory[]> {
    return [...(await this.themesFacade.listCategories())]
  }
}
