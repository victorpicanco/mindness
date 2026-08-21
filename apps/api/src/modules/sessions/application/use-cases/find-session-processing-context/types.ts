import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

export interface FindSessionProcessingContextInput {
  readonly sessionId: string
}
export interface FindSessionProcessingContextDependencies {
  readonly sessions: Pick<SessionsRepository, 'findById'>
}
export interface SessionProcessingContext {
  readonly sessionId: string
  readonly accountId: string
  readonly themeId: string
  readonly audioPath: string
  readonly recordedAt: Date
}
