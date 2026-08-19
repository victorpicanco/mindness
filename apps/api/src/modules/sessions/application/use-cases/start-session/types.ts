import type {
  SearchWindowMinutes,
  SessionDifficulty,
} from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

export interface StartSessionInput {
  readonly accountId: string
  readonly difficulty: SessionDifficulty
  readonly categorySlug: string
  readonly searchWindowMinutes: SearchWindowMinutes
}
