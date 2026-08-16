import { InvalidThemeTransitionError } from '@/modules/themes/domain/errors/invalid-theme-transition-error/index.js'
import type { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'

import type {
  CreateThemeParams,
  ReconstituteThemeParams,
  ThemeDifficulty,
  ThemePublicationStatus,
} from './types.js'

const INITIAL_PUBLICATION_STATUS: ThemePublicationStatus = 'draft'

export class Theme {
  private constructor(
    readonly id: string,
    private _title: ThemeTitle,
    readonly categoryId: string,
    private _difficulty: ThemeDifficulty,
    private _publicationStatus: ThemePublicationStatus,
    private readonly createdAtEpoch: number,
  ) {}

  get publicationStatus(): ThemePublicationStatus {
    return this._publicationStatus
  }

  get title(): ThemeTitle {
    return this._title
  }

  get difficulty(): ThemeDifficulty {
    return this._difficulty
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

  static reconstitute(params: ReconstituteThemeParams): Theme {
    return new Theme(
      params.id,
      params.title,
      params.categoryId,
      params.difficulty,
      params.publicationStatus,
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

  rename(title: ThemeTitle): void {
    this._title = title
  }

  changeDifficulty(difficulty: ThemeDifficulty): void {
    this._difficulty = difficulty
  }

  isEligible(): boolean {
    return this._publicationStatus === 'published'
  }

  private changePublicationStatus(targetStatus: ThemePublicationStatus): void {
    if (!this.canTransitionTo(targetStatus)) {
      throw new InvalidThemeTransitionError(this._publicationStatus, targetStatus)
    }

    this._publicationStatus = targetStatus
  }

  private canTransitionTo(targetStatus: ThemePublicationStatus): boolean {
    if (this._publicationStatus === 'draft') {
      return targetStatus === 'published' || targetStatus === 'withdrawn'
    }
    if (this._publicationStatus === 'published') {
      return targetStatus === 'draft' || targetStatus === 'withdrawn'
    }

    return targetStatus === 'published'
  }
}

export type {
  CreateThemeParams,
  ReconstituteThemeParams,
  ThemeDifficulty,
  ThemePublicationStatus,
} from './types.js'
