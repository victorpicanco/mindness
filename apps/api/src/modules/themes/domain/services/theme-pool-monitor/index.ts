export const THEME_POOL_MINIMUM = 10

export type ThemePoolStatus = 'empty' | 'low' | 'healthy'

export class ThemePoolMonitor {
  static evaluate(publishedCount: number): ThemePoolStatus {
    if (publishedCount === 0) return 'empty'
    if (publishedCount < THEME_POOL_MINIMUM) return 'low'

    return 'healthy'
  }
}
