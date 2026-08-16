import { InvalidThemeTransitionError } from '@/modules/themes/domain/errors/invalid-theme-transition-error/index.js'
import type { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'

import type { CreateThemeParams, ThemeDifficulty, ThemePublicationStatus } from './types.js'

const INITIAL_PUBLICATION_STATUS: ThemePublicationStatus = 'draft'

export class Theme {
  private constructor(
    readonly id: string,
    readonly title: ThemeTitle,
    readonly categoryId: string,
    readonly difficulty: ThemeDifficulty,
    private _publicationStatus: ThemePublicationStatus,
    private readonly createdAtEpoch: number,
  ) {}

  get publicationStatus(): ThemePublicationStatus {
    return this._publicationStatus
  }

  get createdAt(): Date {
    return new Date(this.createdAtEpoch)
  }

  static create(params: CreateThemeParams): Theme {
    return new Theme(
      params.id,
      params.title,
      params.categoryId,
      params.difficulty,
      INITIAL_PUBLICATION_STATUS,
      params.createdAt.getTime(),
    )
  }

  publish(): void {
    this.changePublicationStatus('published')
  }

  withdraw(): void {
    this.changePublicationStatus('withdrawn')
  }

  moveToDraft(): void {
    this.changePublicationStatus('draft')
  }

  isEligible(): boolean {
    return this._publicationStatus === 'published'
  }

  private changePublicationStatus(targetStatus: ThemePublicationStatus): void {
    if (this._publicationStatus === targetStatus) {
      throw new InvalidThemeTransitionError(this._publicationStatus, targetStatus)
    }

    this._publicationStatus = targetStatus
  }
}

export type { CreateThemeParams, ThemeDifficulty, ThemePublicationStatus } from './types.js'
