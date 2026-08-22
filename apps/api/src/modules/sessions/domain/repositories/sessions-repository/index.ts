import type { Session } from '@/modules/sessions/domain/entities/session/index.js'

export interface SessionsRepository {
  findById(sessionId: string): Promise<Session | null>
  findActiveByAccountId(accountId: string): Promise<Session | null>
  findExpiredInProgress(before: Date, limit: number): Promise<Session[]>
  findStuckProcessing(before: Date, limit: number): Promise<Session[]>
  save(session: Session): Promise<void>
}
