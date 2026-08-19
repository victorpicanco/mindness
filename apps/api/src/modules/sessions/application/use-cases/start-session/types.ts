import type {
  SearchWindowMinutes,
  SessionDifficulty,
} from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import type { SessionExpiredReason } from '@/modules/sessions/domain/entities/session/index.js'

export interface StartSessionInput {
  readonly accountId: string
  readonly difficulty: SessionDifficulty
  readonly categorySlug: string
  readonly searchWindowMinutes: SearchWindowMinutes
}

export interface ExpireSession {
  execute(input: {
    readonly accountId: string
    readonly sessionId: string
    readonly reason: SessionExpiredReason
  }): Promise<void>
}

export interface StartSessionOutput {
  readonly sessionId: string
  readonly themeId: string
  readonly expiresAt: string
  readonly remaining: number | null
}
