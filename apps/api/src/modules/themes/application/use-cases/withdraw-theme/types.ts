import type { ThemePublicationStatus } from '@/modules/themes/domain/entities/theme/index.js'

export interface WithdrawThemeInput {
  readonly themeId: string
}

export interface WithdrawThemeOutput {
  readonly themeId: string
  readonly publicationStatus: ThemePublicationStatus
}
