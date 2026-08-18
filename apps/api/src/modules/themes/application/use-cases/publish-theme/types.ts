import type { ThemePublicationStatus } from '@/modules/themes/domain/entities/theme/index.js'

export interface PublishThemeInput {
  readonly themeId: string
}

export interface PublishThemeOutput {
  readonly themeId: string
  readonly publicationStatus: ThemePublicationStatus
}
