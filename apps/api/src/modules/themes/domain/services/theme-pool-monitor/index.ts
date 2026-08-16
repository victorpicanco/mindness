import {
  ThemePoolLow,
  type CreateThemePoolLowParams,
} from '@/modules/themes/domain/events/theme-pool-low/index.js'

export const THEME_POOL_MINIMUM = 10

export type ThemePoolStatus = 'empty' | 'low' | 'healthy'

export class ThemePoolMonitor {
  static evaluate(publishedCount: number): ThemePoolStatus {
    if (publishedCount === 0) return 'empty'
    if (publishedCount < THEME_POOL_MINIMUM) return 'low'

    return 'healthy'
  }

  static createLowAlert(params: Omit<CreateThemePoolLowParams, 'minimum'>): ThemePoolLow | null {
    if (this.evaluate(params.publishedCount) === 'healthy') return null

    return ThemePoolLow.create({ ...params, minimum: THEME_POOL_MINIMUM })
  }
}
