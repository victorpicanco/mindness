import type { ThemePublicationStatus } from '@/modules/themes/domain/entities/theme/index.js'

export interface MoveThemeToDraftInput {
  readonly themeId: string
}

export interface MoveThemeToDraftOutput {
  readonly themeId: string
  readonly publicationStatus: ThemePublicationStatus
}
