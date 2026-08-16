import type { ThemeCombination } from '@/modules/themes/domain/repositories/themes-repository/index.js'

export interface ThemePoolAudit {
  record(combination: ThemeCombination): Promise<void>
}
