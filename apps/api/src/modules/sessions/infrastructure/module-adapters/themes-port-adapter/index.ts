import type { ThemesPublicApi } from '@/modules/themes/index.js'
import type {
  DrawEligibleThemeInput,
  EligibleTheme,
  ThemesPort,
} from '@/modules/sessions/domain/ports/themes-port/index.js'

export type ThemesEligibilityReader = Pick<ThemesPublicApi, 'drawEligibleTheme'>

export class ThemesPortAdapter implements ThemesPort {
  constructor(private readonly themesFacade: ThemesEligibilityReader) {}

  async drawEligibleTheme(input: DrawEligibleThemeInput): Promise<EligibleTheme | null> {
    const theme = await this.themesFacade.drawEligibleTheme(input)
    return theme === null ? null : { themeId: theme.themeId }
  }
}
